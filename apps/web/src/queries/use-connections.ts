import { useMutation } from "@tanstack/react-query";
import {
  authorizeConnection,
  type AuthorizeConnectionInput,
} from "../api/connections.api";

export function useAuthorizeConnection() {
  return useMutation({
    mutationFn: (input: AuthorizeConnectionInput) =>
      authorizeConnection(input).then((r) => r.data),
  });
}
