export interface Template {
  id: string;
  businessId: string;
  name: string;
  subject: string | null;
  body: string;
  signature: string | null;
  createdAt: Date;
  updatedAt: Date;
}
