import type { Template } from "./template.entity";

export interface CreateTemplateInput {
  businessId: string;
  name: string;
  subject: string | null;
  body: string;
  signature: string | null;
}

export interface UpdateTemplateInput {
  name?: string;
  subject?: string | null;
  body?: string;
  signature?: string | null;
}

export interface TemplateRepository {
  list(businessId: string): Promise<Template[]>;
  findById(id: string, businessId: string): Promise<Template | null>;
  create(input: CreateTemplateInput): Promise<Template>;
  update(
    id: string,
    businessId: string,
    patch: UpdateTemplateInput,
  ): Promise<Template | null>;
  delete(id: string, businessId: string): Promise<boolean>;
  attachToCustomer(
    templateId: string,
    customerId: string,
    businessId: string,
  ): Promise<void>;
  detachFromCustomer(
    templateId: string,
    customerId: string,
    businessId: string,
  ): Promise<void>;
}

export const TEMPLATE_REPOSITORY = Symbol("TemplateRepository");
