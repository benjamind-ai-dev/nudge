import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  userRoleSchema,
  type UserRole,
} from "../../../common/auth-context/caller-context.types";
import type { UserListItem } from "../domain/user.entity";
import type { UserRepository } from "../domain/user.repository";
import { EmailAlreadyInUseError } from "../domain/user.errors";

const ROW_SELECT = {
  id: true,
  accountId: true,
  email: true,
  name: true,
  role: true,
  lastLoginAt: true,
  clerkUserId: true,
} satisfies Prisma.UserSelect;

type Row = Prisma.UserGetPayload<{ select: typeof ROW_SELECT }>;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async findManyByAccount(accountId: string): Promise<UserListItem[]> {
    // Sort owner-first (single owner per account), then by name ASC.
    // Postgres CASE expression isn't trivial via Prisma, so we do it in
    // application-side after the order-by-name query.
    const rows = await this.prisma.user.findMany({
      where: { accountId },
      select: ROW_SELECT,
      orderBy: { name: "asc" },
    });

    const mapped = rows.map((r) => this.toDomain(r));
    return mapped.sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async findByIdInAccount(
    id: string,
    accountId: string,
  ): Promise<UserListItem | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, accountId },
      select: ROW_SELECT,
    });
    return row ? this.toDomain(row) : null;
  }

  async updateRole(
    id: string,
    accountId: string,
    role: Exclude<UserRole, "owner">,
  ): Promise<UserListItem> {
    // Tenant-scoped update via updateMany to ensure we never write outside
    // the account, then re-read for the typed payload.
    await this.prisma.user.updateMany({
      where: { id, accountId },
      data: { role },
    });
    const updated = await this.prisma.user.findFirst({
      where: { id, accountId },
      select: ROW_SELECT,
    });
    if (!updated) {
      // Defensive — the use case checked existence already.
      throw new Error(`User ${id} disappeared during updateRole`);
    }
    return this.toDomain(updated);
  }

  async delete(id: string, accountId: string): Promise<number> {
    const result = await this.prisma.user.deleteMany({
      where: { id, accountId },
    });
    return result.count;
  }

  async findByEmailInAccount(
    email: string,
    accountId: string,
  ): Promise<UserListItem | null> {
    const row = await this.prisma.user.findFirst({
      where: { email, accountId },
      select: ROW_SELECT,
    });
    return row ? this.toDomain(row) : null;
  }

  async createPending(params: {
    accountId: string;
    email: string;
    name: string;
    role: Exclude<UserRole, "owner">;
  }): Promise<UserListItem> {
    try {
      const row = await this.prisma.user.create({
        data: {
          accountId: params.accountId,
          email: params.email,
          name: params.name,
          role: params.role,
          clerkUserId: null,
        },
        select: ROW_SELECT,
      });
      return this.toDomain(row);
    } catch (err) {
      // Prisma unique-constraint violation: emit the domain error so the use case
      // can translate it to a 409 without leaking cross-account info.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new EmailAlreadyInUseError(params.email);
      }
      throw err;
    }
  }

  async deleteById(id: string, accountId: string): Promise<number> {
    const result = await this.prisma.user.deleteMany({ where: { id, accountId } });
    return result.count;
  }

  async linkClerkUserId(params: {
    userId: string;
    accountId: string;
    clerkUserId: string;
  }): Promise<UserListItem | null> {
    // Read the pending row scoped to (id, accountId) first, then decide
    // based on its current clerkUserId value.
    const existing = await this.prisma.user.findFirst({
      where: { id: params.userId, accountId: params.accountId },
      select: ROW_SELECT,
    });
    if (!existing) return null;
    if (existing.clerkUserId !== null && existing.clerkUserId !== params.clerkUserId) {
      return null; // already linked to a DIFFERENT Clerk user — defensive
    }
    if (existing.clerkUserId === params.clerkUserId) {
      return this.toDomain(existing); // idempotent no-op
    }
    await this.prisma.user.updateMany({
      where: { id: params.userId, accountId: params.accountId, clerkUserId: null },
      data: { clerkUserId: params.clerkUserId },
    });
    const updated = await this.prisma.user.findFirst({
      where: { id: params.userId, accountId: params.accountId },
      select: ROW_SELECT,
    });
    return updated ? this.toDomain(updated) : null;
  }

  private toDomain(row: Row): UserListItem {
    const parsed = userRoleSchema.safeParse(row.role);
    if (!parsed.success) {
      throw new Error(
        `Invalid role "${row.role}" for user ${row.id} — DB role does not match allowed values`,
      );
    }
    return {
      id: row.id,
      accountId: row.accountId,
      email: row.email,
      name: row.name,
      role: parsed.data,
      lastLoginAt: row.lastLoginAt,
      clerkUserId: row.clerkUserId,
    };
  }
}
