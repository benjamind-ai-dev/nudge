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
  customerCount: number;
  invoiceCount: number;
  connections: ConnectionInfo[];
}

export interface BusinessSettings {
  id: string;
  name: string;
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
  name?: string;
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
