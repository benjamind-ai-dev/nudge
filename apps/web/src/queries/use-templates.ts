import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTemplate,
  deleteTemplate,
  generateTemplate,
  getTemplate,
  getTemplates,
  updateTemplate,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type TemplateListItem,
} from "../api/templates.api";

export function useTemplates(businessId: string) {
  return useQuery<{ data: TemplateListItem[] }>({
    queryKey: ["templates", businessId],
    queryFn: () => getTemplates(businessId),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

export function useTemplate(id: string | undefined, businessId: string) {
  return useQuery({
    queryKey: ["templates", businessId, id],
    queryFn: () => getTemplate(id as string, businessId),
    enabled: Boolean(businessId) && Boolean(id),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => createTemplate(input),
    onSuccess: (_res, input) => {
      void qc.invalidateQueries({ queryKey: ["templates", input.businessId] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTemplateInput }) =>
      updateTemplate(id, input),
    onSuccess: (_res, { input }) => {
      void qc.invalidateQueries({ queryKey: ["templates", input.businessId] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) =>
      deleteTemplate(id, businessId),
    onSuccess: (_res, { businessId }) => {
      void qc.invalidateQueries({ queryKey: ["templates", businessId] });
    },
  });
}

export function useGenerateTemplate() {
  return useMutation({
    mutationFn: ({ businessId, description }: { businessId: string; description: string }) =>
      generateTemplate(businessId, description),
  });
}
