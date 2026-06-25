export interface Template {
  id: string;
  businessId: string;
  name: string;
  subject: string | null;
  body: string;
  signature: string | null;
  smsBody: string | null;
  createdAt: Date;
  updatedAt: Date;
}
