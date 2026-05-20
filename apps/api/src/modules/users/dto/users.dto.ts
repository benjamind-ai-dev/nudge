import { z } from "zod";

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "viewer"]),
});
export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>;
