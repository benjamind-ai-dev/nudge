export const BUSINESS_REPOSITORY = Symbol("BUSINESS_REPOSITORY");

export interface ConnectionInfo {
  provider: string;
  status: string;
  lastSyncAt: Date | null;
}

export interface BusinessWithConnections {
  id: string;
  name: string;
  accountingProvider: string;
  senderName: string;
  senderEmail: string;
  emailSignature: string | null;
  timezone: string;
  isActive: boolean;
  connections: ConnectionInfo[];
}

export interface BusinessSettings {
  id: string;
  senderName: string;
  senderEmail: string;
  emailSignature: string | null;
  timezone: string;
}

export interface CreateBusinessData {
  accountId: string;
  name: string;
  accountingProvider: string;
  senderName: string;
  senderEmail: string;
  timezone: string;
  emailSignature?: string;
}

export interface UpdateBusinessSettingsData {
  senderName?: string;
  senderEmail?: string;
  emailSignature?: string | null;
  timezone?: string;
}

export interface BusinessRepository {
  findById(id: string): Promise<BusinessWithConnections | null>;
  create(data: CreateBusinessData): Promise<BusinessWithConnections>;
  updateSettings(id: string, data: UpdateBusinessSettingsData): Promise<BusinessSettings>;
  softDelete(id: string): Promise<void>;
}
