import { Module } from "@nestjs/common";
import { USER_REPOSITORY } from "./domain/user.repository";
import { CLERK_INVITATION_SERVICE } from "./domain/clerk-invitation.service";
import { CLERK_ORGANIZATION_SERVICE } from "./domain/clerk-organization.service";
import { PrismaUserRepository } from "./infrastructure/prisma-user.repository";
import { ClerkInvitationService } from "./infrastructure/clerk-invitation.service";
import { ClerkOrganizationService } from "./infrastructure/clerk-organization.service";
import { ListUsersUseCase } from "./application/list-users.use-case";
import { UpdateUserRoleUseCase } from "./application/update-user-role.use-case";
import { DeleteUserUseCase } from "./application/delete-user.use-case";
import { InviteUserUseCase } from "./application/invite-user.use-case";
import { CancelInviteUseCase } from "./application/cancel-invite.use-case";
import { ResendInviteUseCase } from "./application/resend-invite.use-case";
import { UsersController } from "./users.controller";

@Module({
  controllers: [UsersController],
  providers: [
    ListUsersUseCase,
    UpdateUserRoleUseCase,
    DeleteUserUseCase,
    InviteUserUseCase,
    CancelInviteUseCase,
    ResendInviteUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: CLERK_INVITATION_SERVICE, useClass: ClerkInvitationService },
    { provide: CLERK_ORGANIZATION_SERVICE, useClass: ClerkOrganizationService },
  ],
  exports: [USER_REPOSITORY, CLERK_ORGANIZATION_SERVICE],
})
export class UsersModule {}
