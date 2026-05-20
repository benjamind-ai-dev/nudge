import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { UsersController } from "./users.controller";
import { ListUsersUseCase } from "./application/list-users.use-case";
import { UpdateUserRoleUseCase } from "./application/update-user-role.use-case";
import { DeleteUserUseCase } from "./application/delete-user.use-case";
import { InviteUserUseCase } from "./application/invite-user.use-case";
import { CallerContextService } from "../../common/auth-context/caller-context.service";
import {
  CannotChangeOwnRoleError,
  CannotChangeOwnerRoleError,
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  EmailAlreadyInUseError,
  InviteSendFailedError,
  UserNotFoundError,
} from "./domain/user.errors";
import type { UserListItem } from "./domain/user.entity";
import type { CallerContext } from "../../common/auth-context/caller-context.types";

const CLERK_OWNER = "user_owner_clerk";
const ACCOUNT_ID = "550e8400-e29b-41d4-a716-446655440000";
const OWNER_USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const TARGET_USER_ID = "550e8400-e29b-41d4-a716-446655440002";

const ownerCtx: CallerContext = {
  userId: OWNER_USER_ID,
  accountId: ACCOUNT_ID,
  role: "owner",
};

const adminCtx: CallerContext = {
  userId: OWNER_USER_ID,
  accountId: ACCOUNT_ID,
  role: "admin",
};

const mkUser = (over: Partial<UserListItem> = {}): UserListItem => ({
  id: TARGET_USER_ID,
  accountId: ACCOUNT_ID,
  email: "t@example.com",
  name: "Target",
  role: "admin",
  lastLoginAt: null,
  clerkUserId: "user_target_clerk",
  ...over,
});

describe("UsersController", () => {
  let app: INestApplication;
  let listUseCase: { execute: jest.Mock };
  let updateUseCase: { execute: jest.Mock };
  let deleteUseCase: { execute: jest.Mock };
  let inviteUseCase: { execute: jest.Mock };
  let callerCtx: { resolve: jest.Mock };

  beforeEach(async () => {
    listUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };
    inviteUseCase = { execute: jest.fn() };
    callerCtx = { resolve: jest.fn().mockResolvedValue(ownerCtx) };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: ListUsersUseCase, useValue: listUseCase },
        { provide: UpdateUserRoleUseCase, useValue: updateUseCase },
        { provide: DeleteUserUseCase, useValue: deleteUseCase },
        { provide: InviteUserUseCase, useValue: inviteUseCase },
        { provide: CallerContextService, useValue: callerCtx },
      ],
    }).compile();

    app = module.createNestApplication();
    // Simulate Clerk middleware: @AccountId() calls req.auth().userId
    app.use(
      (req: { auth: () => { userId: string } }, _res: unknown, next: () => void) => {
        req.auth = () => ({ userId: CLERK_OWNER });
        next();
      },
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/users", () => {
    it("returns 200 with the user list", async () => {
      listUseCase.execute.mockResolvedValue([mkUser()]);

      const res = await request(app.getHttpServer()).get("/v1/users").expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(TARGET_USER_ID);
      expect(listUseCase.execute).toHaveBeenCalledWith(ACCOUNT_ID);
    });

    it("allows admin and viewer callers (no role gate on GET)", async () => {
      callerCtx.resolve.mockResolvedValue(adminCtx);
      listUseCase.execute.mockResolvedValue([]);

      await request(app.getHttpServer()).get("/v1/users").expect(200);
    });

    it("returns 401 when caller context cannot be resolved", async () => {
      callerCtx.resolve.mockResolvedValue(null);

      await request(app.getHttpServer()).get("/v1/users").expect(401);
      expect(listUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /v1/users/:id", () => {
    it("returns 200 with the updated user", async () => {
      updateUseCase.execute.mockResolvedValue(mkUser({ role: "viewer" }));

      const res = await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "viewer" })
        .expect(200);

      expect(res.body.data.role).toBe("viewer");
      expect(updateUseCase.execute).toHaveBeenCalledWith({
        callerUserId: OWNER_USER_ID,
        accountId: ACCOUNT_ID,
        targetId: TARGET_USER_ID,
        newRole: "viewer",
      });
    });

    it("returns 401 when caller context cannot be resolved", async () => {
      callerCtx.resolve.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "admin" })
        .expect(401);
    });

    it("returns 403 when caller is not owner", async () => {
      callerCtx.resolve.mockResolvedValue(adminCtx);

      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "viewer" })
        .expect(403);
      expect(updateUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 400 when role missing", async () => {
      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({})
        .expect(400);
    });

    it("returns 400 when role is 'owner'", async () => {
      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "owner" })
        .expect(400);
    });

    it("returns 404 on UserNotFoundError", async () => {
      updateUseCase.execute.mockRejectedValue(new UserNotFoundError(TARGET_USER_ID));

      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "viewer" })
        .expect(404);
    });

    it("returns 400 on CannotChangeOwnRoleError", async () => {
      updateUseCase.execute.mockRejectedValue(new CannotChangeOwnRoleError());

      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "viewer" })
        .expect(400);
    });

    it("returns 400 on CannotChangeOwnerRoleError", async () => {
      updateUseCase.execute.mockRejectedValue(new CannotChangeOwnerRoleError());

      await request(app.getHttpServer())
        .patch(`/v1/users/${TARGET_USER_ID}`)
        .send({ role: "viewer" })
        .expect(400);
    });
  });

  describe("DELETE /v1/users/:id", () => {
    it("returns 204 on success", async () => {
      deleteUseCase.execute.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/v1/users/${TARGET_USER_ID}`)
        .expect(204);

      expect(deleteUseCase.execute).toHaveBeenCalledWith({
        callerUserId: OWNER_USER_ID,
        accountId: ACCOUNT_ID,
        targetId: TARGET_USER_ID,
      });
    });

    it("returns 401 when caller context cannot be resolved", async () => {
      callerCtx.resolve.mockResolvedValue(null);

      await request(app.getHttpServer())
        .delete(`/v1/users/${TARGET_USER_ID}`)
        .expect(401);
    });

    it("returns 403 when caller is not owner", async () => {
      callerCtx.resolve.mockResolvedValue(adminCtx);

      await request(app.getHttpServer())
        .delete(`/v1/users/${TARGET_USER_ID}`)
        .expect(403);
      expect(deleteUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 404 on UserNotFoundError", async () => {
      deleteUseCase.execute.mockRejectedValue(new UserNotFoundError(TARGET_USER_ID));

      await request(app.getHttpServer())
        .delete(`/v1/users/${TARGET_USER_ID}`)
        .expect(404);
    });

    it("returns 400 on CannotRemoveSelfError", async () => {
      deleteUseCase.execute.mockRejectedValue(new CannotRemoveSelfError());

      await request(app.getHttpServer())
        .delete(`/v1/users/${TARGET_USER_ID}`)
        .expect(400);
    });

    it("returns 400 on CannotRemoveOwnerError", async () => {
      deleteUseCase.execute.mockRejectedValue(new CannotRemoveOwnerError());

      await request(app.getHttpServer())
        .delete(`/v1/users/${TARGET_USER_ID}`)
        .expect(400);
    });
  });

  describe("POST /v1/users/invite", () => {
    const INVITE_BODY = { email: "new@example.com", role: "viewer" as const, name: "New" };

    it("returns 201 on success", async () => {
      inviteUseCase.execute.mockResolvedValue({
        user: mkUser({ id: "new_user", email: INVITE_BODY.email, clerkUserId: null, role: "viewer" }),
        clerkInvitationId: "inv_abc",
      });

      const res = await request(app.getHttpServer())
        .post("/v1/users/invite")
        .send(INVITE_BODY)
        .expect(201);

      expect(res.body.data).toEqual(
        expect.objectContaining({
          id: "new_user",
          email: INVITE_BODY.email,
          role: "viewer",
          status: "pending",
          clerkInvitationId: "inv_abc",
        }),
      );
      expect(inviteUseCase.execute).toHaveBeenCalledWith({
        callerAccountId: ACCOUNT_ID,
        email: INVITE_BODY.email,
        role: "viewer",
        name: "New",
      });
    });

    it("returns 201 with null clerkInvitationId on idempotent re-invite", async () => {
      inviteUseCase.execute.mockResolvedValue({
        user: mkUser({ id: "existing", clerkUserId: null }),
        clerkInvitationId: null,
      });
      const res = await request(app.getHttpServer())
        .post("/v1/users/invite")
        .send(INVITE_BODY)
        .expect(201);
      expect(res.body.data.clerkInvitationId).toBeNull();
    });

    it("admin caller is allowed (201)", async () => {
      callerCtx.resolve.mockResolvedValue(adminCtx);
      inviteUseCase.execute.mockResolvedValue({
        user: mkUser({ clerkUserId: null }),
        clerkInvitationId: "inv_abc",
      });
      await request(app.getHttpServer()).post("/v1/users/invite").send(INVITE_BODY).expect(201);
    });

    it("returns 401 when caller context cannot be resolved", async () => {
      callerCtx.resolve.mockResolvedValue(null);
      await request(app.getHttpServer()).post("/v1/users/invite").send(INVITE_BODY).expect(401);
      expect(inviteUseCase.execute).not.toHaveBeenCalled();
    });

    it("returns 403 when caller is viewer", async () => {
      callerCtx.resolve.mockResolvedValue({ ...adminCtx, role: "viewer" });
      await request(app.getHttpServer()).post("/v1/users/invite").send(INVITE_BODY).expect(403);
    });

    it("returns 400 on bad email", async () => {
      await request(app.getHttpServer())
        .post("/v1/users/invite")
        .send({ ...INVITE_BODY, email: "notanemail" })
        .expect(400);
    });

    it("returns 400 when role=owner", async () => {
      await request(app.getHttpServer())
        .post("/v1/users/invite")
        .send({ ...INVITE_BODY, role: "owner" })
        .expect(400);
    });

    it("returns 409 on EmailAlreadyInUseError", async () => {
      inviteUseCase.execute.mockRejectedValue(new EmailAlreadyInUseError("x@example.com"));
      await request(app.getHttpServer()).post("/v1/users/invite").send(INVITE_BODY).expect(409);
    });

    it("returns 502 on InviteSendFailedError", async () => {
      inviteUseCase.execute.mockRejectedValue(new InviteSendFailedError("x@example.com"));
      await request(app.getHttpServer()).post("/v1/users/invite").send(INVITE_BODY).expect(502);
    });
  });
});
