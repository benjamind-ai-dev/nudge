import { apiClient } from "./client";

export interface Template {
  id: string;
  businessId: string;
  name: string;
  subject: string | null;
  body: string;
  signature: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiTemplateDraft {
  name: string;
  subject: string;
  body: string;
  signature: string;
}

export interface CreateTemplateInput {
  businessId: string;
  name: string;
  subject?: string | null;
  body: string;
  signature?: string | null;
}

export type UpdateTemplateInput = {
  businessId: string;
  name?: string;
  subject?: string | null;
  body?: string;
  signature?: string | null;
};

export interface TemplateListItem extends Template {
  inUse: boolean;
}

export function getTemplates(businessId: string): Promise<{ data: TemplateListItem[] }> {
  return apiClient(`/v1/templates?businessId=${businessId}`);
}

export function getTemplate(id: string, businessId: string): Promise<{ data: Template }> {
  return apiClient(`/v1/templates/${id}?businessId=${businessId}`);
}

export function createTemplate(input: CreateTemplateInput): Promise<{ data: Template }> {
  return apiClient(`/v1/templates`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
): Promise<{ data: Template }> {
  return apiClient(`/v1/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTemplate(id: string, businessId: string): Promise<void> {
  return apiClient(`/v1/templates/${id}?businessId=${businessId}`, {
    method: "DELETE",
  });
}

export function generateTemplate(
  businessId: string,
  description: string,
): Promise<{ data: AiTemplateDraft }> {
  return apiClient(`/v1/templates/generate?businessId=${businessId}`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}
