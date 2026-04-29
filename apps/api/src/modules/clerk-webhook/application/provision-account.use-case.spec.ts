import { ProvisionAccountUseCase } from "./provision-account.use-case";
import { AccountProvisionRepository } from "../domain/account-provision.repository";

const makeRepo = (overrides: Partial<AccountProvisionRepository> = {}): AccountProvisionRepository => ({
  findByClerkId: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("ProvisionAccountUseCase", () => {
  it("creates an account for a new Clerk user", async () => {
    const repo = makeRepo();
    const useCase = new ProvisionAccountUseCase(repo);

    await useCase.execute("user_abc123", "alice@example.com", "Alice Smith");

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkId: "user_abc123",
        email: "alice@example.com",
        name: "Alice Smith",
        plan: null,
        status: "trial",
        maxBusinesses: 1,
      }),
    );
    expect((repo.create as jest.Mock).mock.calls[0][0].trialEndsAt).toBeInstanceOf(Date);
  });

  it("falls back to email prefix when name is empty", async () => {
    const repo = makeRepo();
    const useCase = new ProvisionAccountUseCase(repo);

    await useCase.execute("user_abc123", "bob@example.com", "");

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "bob" }),
    );
  });

  it("is idempotent — does not create if account already exists", async () => {
    const repo = makeRepo({
      findByClerkId: jest.fn().mockResolvedValue({ clerkId: "user_abc123" }),
    });
    const useCase = new ProvisionAccountUseCase(repo);

    await useCase.execute("user_abc123", "alice@example.com", "Alice Smith");

    expect(repo.create).not.toHaveBeenCalled();
  });
});
