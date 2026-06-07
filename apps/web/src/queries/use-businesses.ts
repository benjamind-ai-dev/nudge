import { useMutation } from "@tanstack/react-query";
import { createBusiness, type CreateBusinessInput } from "../api/businesses.api";

export function useCreateBusiness() {
  return useMutation({
    mutationFn: (input: CreateBusinessInput) =>
      createBusiness(input).then((r) => r.data),
  });
}
