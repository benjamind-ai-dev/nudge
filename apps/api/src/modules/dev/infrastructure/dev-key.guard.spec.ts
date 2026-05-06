import { ExecutionContext, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DevKeyGuard } from "./dev-key.guard";
import type { Env } from "../../../common/config/env.schema";

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, path: "/v1/dev/x" }),
    }),
  } as unknown as ExecutionContext;
}

function makeConfig(values: Partial<Pick<Env, "DEV_MODE" | "DEV_API_KEY">>): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => values[key as "DEV_MODE" | "DEV_API_KEY"],
  } as unknown as ConfigService<Env, true>;
}

describe("DevKeyGuard", () => {
  it("returns 404 when DEV_MODE is false", () => {
    const guard = new DevKeyGuard(makeConfig({ DEV_MODE: false }));
    expect(() => guard.canActivate(makeContext())).toThrow(NotFoundException);
  });

  it("returns 404 when DEV_MODE is true but DEV_API_KEY is unset", () => {
    const guard = new DevKeyGuard(makeConfig({ DEV_MODE: true, DEV_API_KEY: undefined }));
    expect(() => guard.canActivate(makeContext({ "x-dev-key": "anything" }))).toThrow(
      NotFoundException,
    );
  });

  it("returns 401 when X-Dev-Key header is missing", () => {
    const guard = new DevKeyGuard(makeConfig({ DEV_MODE: true, DEV_API_KEY: "secretsecretsecret" }));
    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
  });

  it("returns 401 when X-Dev-Key does not match DEV_API_KEY", () => {
    const guard = new DevKeyGuard(makeConfig({ DEV_MODE: true, DEV_API_KEY: "secretsecretsecret" }));
    expect(() => guard.canActivate(makeContext({ "x-dev-key": "wrong" }))).toThrow(
      UnauthorizedException,
    );
  });

  it("allows the request when DEV_MODE is true and X-Dev-Key matches", () => {
    const guard = new DevKeyGuard(makeConfig({ DEV_MODE: true, DEV_API_KEY: "secretsecretsecret" }));
    expect(guard.canActivate(makeContext({ "x-dev-key": "secretsecretsecret" }))).toBe(true);
  });
});
