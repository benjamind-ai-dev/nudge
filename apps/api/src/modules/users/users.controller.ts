import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AccountId } from "../../common/decorators/account-id.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CallerContextService } from "../../common/auth-context/caller-context.service";
import { ListUsersUseCase } from "./application/list-users.use-case";
import { UpdateUserRoleUseCase } from "./application/update-user-role.use-case";
import { DeleteUserUseCase } from "./application/delete-user.use-case";
import { InviteUserUseCase } from "./application/invite-user.use-case";
import { CancelInviteUseCase } from "./application/cancel-invite.use-case";
import { ResendInviteUseCase } from "./application/resend-invite.use-case";
import {
  inviteUserSchema,
  updateUserRoleSchema,
  type InviteUserDto,
  type UpdateUserRoleDto,
} from "./dto/users.dto";

@Controller("v1/users")
export class UsersController {
  constructor(
    private readonly callerCtx: CallerContextService,
    private readonly listUsers: ListUsersUseCase,
    private readonly updateUserRole: UpdateUserRoleUseCase,
    private readonly deleteUser: DeleteUserUseCase,
    private readonly inviteUser: InviteUserUseCase,
    private readonly cancelInvite: CancelInviteUseCase,
    private readonly resendInvite: ResendInviteUseCase,
  ) {}

  @Get()
  async list(@AccountId() clerkUserId: string) {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    const data = await this.listUsers.execute(caller.accountId);
    return { data };
  }

  @Post("invite")
  async invite(
    @AccountId() clerkUserId: string,
    @Body(new ZodValidationPipe(inviteUserSchema)) dto: InviteUserDto,
  ) {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    if (caller.role !== "owner" && caller.role !== "admin") {
      throw new ForbiddenException("Only owners or admins can invite users");
    }

    const { user, clerkInvitationId } = await this.inviteUser.execute({
      callerAccountId: caller.accountId,
      email: dto.email,
      role: dto.role,
      ...(dto.name !== undefined && { name: dto.name }),
    });

    return {
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: "pending" as const,
        clerkInvitationId,
      },
    };
  }

  @Delete("invites/:id")
  @HttpCode(204)
  async cancelInviteEndpoint(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
  ) {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    if (caller.role !== "owner" && caller.role !== "admin") {
      throw new ForbiddenException("Only owners or admins can cancel invites");
    }

    await this.cancelInvite.execute({
      callerAccountId: caller.accountId,
      targetId: id,
    });
  }

  @Post("invites/:id/resend")
  @HttpCode(200)
  async resendInviteEndpoint(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
  ) {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    if (caller.role !== "owner" && caller.role !== "admin") {
      throw new ForbiddenException("Only owners or admins can resend invites");
    }

    const { user, clerkInvitationId } = await this.resendInvite.execute({
      callerAccountId: caller.accountId,
      targetId: id,
    });
    return {
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: "pending" as const,
        clerkInvitationId,
      },
    };
  }

  @Patch(":id")
  async update(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) dto: UpdateUserRoleDto,
  ) {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    if (caller.role !== "owner") {
      throw new ForbiddenException("Only the account owner can change roles");
    }

    const data = await this.updateUserRole.execute({
      callerUserId: caller.userId,
      accountId: caller.accountId,
      targetId: id,
      newRole: dto.role,
    });
    return { data };
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @AccountId() clerkUserId: string,
    @Param("id") id: string,
  ) {
    const caller = await this.callerCtx.resolve(clerkUserId);
    if (!caller) {
      throw new UnauthorizedException("Caller context could not be resolved");
    }
    if (caller.role !== "owner") {
      throw new ForbiddenException("Only the account owner can remove users");
    }

    await this.deleteUser.execute({
      callerUserId: caller.userId,
      accountId: caller.accountId,
      targetId: id,
    });
  }
}
