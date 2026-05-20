import { z } from "zod";

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "viewer"]),
});
export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>;

export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "viewer"]),
  name: z.string().min(1).max(255).optional(),
});
export type InviteUserDto = z.infer<typeof inviteUserSchema>;
