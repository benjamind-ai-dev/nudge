import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../../common/redis/redis.module";
import { ProviderName } from "./oauth-provider";

export interface StatePayload {
  businessId: string;
  provider: ProviderName;
}

const STATE_TTL_SECONDS = 600;
const keyFor = (token: string) => `oauth:state:${token}`;

@Injectable()
export class OAuthStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(payload: StatePayload): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await this.redis.set(
      keyFor(token),
      JSON.stringify(payload),
      "EX",
      STATE_TTL_SECONDS,
    );
    return token;
  }

  async consume(token: string): Promise<StatePayload | null> {
    const raw = await this.redis.getdel(keyFor(token));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as StatePayload;
      return parsed;
    } catch {
      return null;
    }
  }
}
