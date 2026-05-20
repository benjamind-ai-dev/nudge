import { CallerContextService } from "./caller-context.service";
import { CallerContextRepository } from "./caller-context.types";

const makeRepo = (
  overrides: Partial<CallerContextRepository> = {},
): CallerContextRepository => ({
  findByClerkUserId: jest.fn().mockResolvedValue(null),
  ...overrides,
});

describe("CallerContextService", () => {
  it("resolves owner caller context", async () => {
    const repo = makeRepo({
      findByClerkUserId: jest.fn().mockResolvedValue({
        userId: "u-1",
        accountId: "a-1",
        role: "owner",
      }),
    });
    const service = new CallerContextService(repo);

    const ctx = await service.resolve("user_abc");

    expect(ctx).toEqual({ userId: "u-1", accountId: "a-1", role: "owner" });
  });

  it("resolves admin caller context", async () => {
    const repo = makeRepo({
      findByClerkUserId: jest.fn().mockResolvedValue({
        userId: "u-2",
        accountId: "a-1",
        role: "admin",
      }),
    });
    const service = new CallerContextService(repo);

    const ctx = await service.resolve("user_def");

    expect(ctx?.role).toBe("admin");
  });

  it("resolves viewer caller context", async () => {
    const repo = makeRepo({
      findByClerkUserId: jest.fn().mockResolvedValue({
        userId: "u-3",
        accountId: "a-1",
        role: "viewer",
      }),
    });
    const service = new CallerContextService(repo);

    const ctx = await service.resolve("user_ghi");

    expect(ctx?.role).toBe("viewer");
  });

  it("returns null when no user row matches", async () => {
    const repo = makeRepo();
    const service = new CallerContextService(repo);

    const ctx = await service.resolve("user_missing");

    expect(ctx).toBeNull();
  });

  it("throws when DB row contains an invalid role value", async () => {
    const repo = makeRepo({
      findByClerkUserId: jest.fn().mockResolvedValue({
        userId: "u-bad",
        accountId: "a-bad",
        role: "superadmin",
      }),
    });
    const service = new CallerContextService(repo);

    await expect(service.resolve("user_bad")).rejects.toThrow(
      /Invalid role/,
    );
  });
});
