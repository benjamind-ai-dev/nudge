import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaClient } from "@nudge/database";
import { QUEUE_NAMES, InvoiceSyncJobData, encrypt } from "@nudge/shared";
import { randomBytes } from "crypto";
import Redis from "ioredis";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import OAuthClient = require("intuit-oauth");
import { PRISMA_CLIENT } from "../../common/database/database.module";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { Env } from "../../common/config/env.schema";

const STATE_TTL_SECONDS = 600;

@Injectable()
export class QuickbooksOAuthService {
  private readonly logger = new Logger(QuickbooksOAuthService.name);

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(QUEUE_NAMES.INVOICE_SYNC)
    private readonly invoiceSyncQueue: Queue<InvoiceSyncJobData>,
  ) {}

  private createOAuthClient(): OAuthClient {
    return new OAuthClient({
      clientId: this.config.get("QUICKBOOKS_CLIENT_ID", { infer: true }),
      clientSecret: this.config.get("QUICKBOOKS_CLIENT_SECRET", {
        infer: true,
      }),
      environment: this.config.get("QUICKBOOKS_ENVIRONMENT", { infer: true }),
      redirectUri: this.config.get("QUICKBOOKS_REDIRECT_URI", { infer: true }),
    });
  }

  async authorize(businessId: string): Promise<{ oauthUrl: string }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException(`Business ${businessId} not found`);
    }

    const state = randomBytes(32).toString("hex");

    await this.redis.set(
      `oauth:state:${state}`,
      businessId,
      "EX",
      STATE_TTL_SECONDS,
    );

    const oauthClient = this.createOAuthClient();
    const oauthUrl = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state,
    });

    return { oauthUrl };
  }

  async callback(
    code: string,
    state: string,
    realmId: string,
  ): Promise<string> {
    const frontendUrl = this.config.get("FRONTEND_URL", { infer: true });
    const errorUrl = (reason: string) =>
      `${frontendUrl}/onboarding/complete?status=error&reason=${reason}`;
    const successUrl = `${frontendUrl}/onboarding/complete?status=success`;

    // 1. Validate state token
    const businessId = await this.redis.get(`oauth:state:${state}`);
    if (!businessId) {
      this.logger.warn({ msg: "Invalid or expired OAuth state token", state });
      return errorUrl("invalid_state");
    }

    // 2. Delete state token (single-use)
    await this.redis.del(`oauth:state:${state}`);

    // 3. Exchange authorization code for tokens via Intuit SDK
    const oauthClient = this.createOAuthClient();
    const redirectUri = this.config.get("QUICKBOOKS_REDIRECT_URI", {
      infer: true,
    });

    let authResponse: { getJson: () => Record<string, unknown> };
    try {
      authResponse = await oauthClient.createToken(
        `${redirectUri}?code=${code}&realmId=${realmId}`,
      );
    } catch (error) {
      this.logger.error({
        msg: "Token exchange failed",
        businessId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return errorUrl("token_exchange_failed");
    }

    const tokens = authResponse.getJson() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // 4. Encrypt tokens
    const encryptionKey = this.config.get("ENCRYPTION_KEY", { infer: true });
    const encryptedAccessToken = encrypt(tokens.access_token, encryptionKey);
    const encryptedRefreshToken = encrypt(tokens.refresh_token, encryptionKey);

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 5. Upsert connection record
    const connection = await this.prisma.connection.upsert({
      where: { businessId },
      create: {
        businessId,
        provider: "quickbooks",
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        realmId,
        scopes: "com.intuit.quickbooks.accounting",
        status: "connected",
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        realmId,
        scopes: "com.intuit.quickbooks.accounting",
        status: "connected",
        errorMessage: null,
      },
    });

    // 6. Enqueue invoice sync
    await this.invoiceSyncQueue.add(QUEUE_NAMES.INVOICE_SYNC, { businessId });

    this.logger.log({
      msg: `Connection created for business ${businessId}, provider: quickbooks, realm: ${realmId}`,
      connectionId: connection.id,
    });

    return successUrl;
  }
}
