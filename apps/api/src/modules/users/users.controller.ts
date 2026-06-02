import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
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
  CannotCancelAcceptedInviteError,
  CannotChangeOwnRoleError,
  CannotChangeOwnerRoleError,
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  EmailAlreadyInUseError,
  InviteSendFailedError,
  PendingUserNotFoundError,
  SeatLimitReachedError,
  UserNotFoundError,
} from "./domain/user.errors";
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

    try {
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
    } catch (err) {
      if (err instanceof EmailAlreadyInUseError) {
        throw new ConflictException(err.message);
      }
      if (err instanceof SeatLimitReachedError) {
        throw new ConflictException(err.message);
      }
      if (err instanceof InviteSendFailedError) {
        throw new BadGatewayException(err.message);
      }
      throw err;
    }
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

    try {
      await this.cancelInvite.execute({
        callerAccountId: caller.accountId,
        targetId: id,
      });
    } catch (err) {
      if (err instanceof PendingUserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (err instanceof CannotCancelAcceptedInviteError) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
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

    try {
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
    } catch (err) {
      if (err instanceof PendingUserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (err instanceof CannotCancelAcceptedInviteError) {
        throw new ConflictException(err.message);
      }
      if (err instanceof InviteSendFailedError) {
        throw new BadGatewayException(err.message);
      }
      throw err;
    }
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

    try {
      const data = await this.updateUserRole.execute({
        callerUserId: caller.userId,
        accountId: caller.accountId,
        targetId: id,
        newRole: dto.role,
      });
      return { data };
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (
        err instanceof CannotChangeOwnRoleError ||
        err instanceof CannotChangeOwnerRoleError
      ) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
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

    try {
      await this.deleteUser.execute({
        callerUserId: caller.userId,
        accountId: caller.accountId,
        targetId: id,
      });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        throw new NotFoundException(err.message);
      }
      if (
        err instanceof CannotRemoveSelfError ||
        err instanceof CannotRemoveOwnerError
      ) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
