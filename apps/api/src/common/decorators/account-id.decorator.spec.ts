import { UnauthorizedException, ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { AccountId } from "./account-id.decorator";

function getParamDecoratorFactory() {
  class TestController {
    test(@AccountId() accountId: string) {
      return accountId;
    }
  }

  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    "test"
  );
  const key = Object.keys(metadata)[0];
  return metadata[key].factory;
}

function createMockExecutionContext(
  authData: { userId?: string } | undefined
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ auth: jest.fn().mockReturnValue(authData ?? {}) }),
    }),
  } as unknown as ExecutionContext;
}

describe("@AccountId decorator", () => {
  const factory = getParamDecoratorFactory();

  it("returns userId when present in request.auth", () => {
    const ctx = createMockExecutionContext({ userId: "user_123abc" });
    const result = factory(undefined, ctx);
    expect(result).toBe("user_123abc");
  });

  it("throws UnauthorizedException when auth is undefined", () => {
    const ctx = createMockExecutionContext(undefined);
    expect(() => factory(undefined, ctx)).toThrow(UnauthorizedException);
    expect(() => factory(undefined, ctx)).toThrow("No account in session");
  });

  it("throws UnauthorizedException when userId is undefined", () => {
    const ctx = createMockExecutionContext({});
    expect(() => factory(undefined, ctx)).toThrow(UnauthorizedException);
    expect(() => factory(undefined, ctx)).toThrow("No account in session");
  });

  it("throws UnauthorizedException when userId is empty string", () => {
    const ctx = createMockExecutionContext({ userId: "" });
    expect(() => factory(undefined, ctx)).toThrow(UnauthorizedException);
  });
});
