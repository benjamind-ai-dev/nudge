import { Inject, Injectable } from "@nestjs/common";
import {
  BUSINESS_REPOSITORY,
  BusinessRepository,
} from "../domain/business.repository";
import { BusinessNotFoundError } from "../domain/connection.errors";
import {
  OAUTH_PROVIDERS,
  OAuthProviderMap,
  ProviderName,
} from "../domain/oauth-provider";
import { OAuthStateService } from "../domain/oauth-state.service";

export interface StartConnectionInput {
  businessId: string;
  provider: ProviderName;
}

export interface StartConnectionOutput {
  oauthUrl: string;
}

@Injectable()
export class StartConnectionUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY)
    private readonly businesses: BusinessRepository,
    private readonly state: OAuthStateService,
    @Inject(OAUTH_PROVIDERS) private readonly providers: OAuthProviderMap,
  ) {}

  async execute(input: StartConnectionInput): Promise<StartConnectionOutput> {
    const business = await this.businesses.findById(input.businessId);
    if (!business) {
      throw new BusinessNotFoundError(input.businessId);
    }
    const token = await this.state.create({
      businessId: input.businessId,
      provider: input.provider,
    });
    const oauthUrl = await this.providers[input.provider].buildAuthUrl(token);
    return { oauthUrl };
  }
}
