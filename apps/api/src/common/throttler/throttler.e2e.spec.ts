import { Controller, Get, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { SkipThrottle, Throttle, ThrottlerModule } from "@nestjs/throttler";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { GlobalExceptionFilter } from "../filters/global-exception.filter";
import { ThrottlerBehindProxyGuard } from "./throttler-behind-proxy.guard";

@Controller("default-route")
class DefaultRouteController {
  @Get()
  ok() {
    return { ok: true };
  }
}

@SkipThrottle({ default: true })
@Throttle({ tight: { limit: 2, ttl: 60_000 } })
@Controller("tight-route")
class TightRouteController {
  @Get()
  ok() {
    return { ok: true };
  }
}

@SkipThrottle({ default: true, tight: true })
@Controller("skip-route")
class SkippedRouteController {
  @Get()
  ok() {
    return { ok: true };
  }
}

@SkipThrottle({ default: true })
@Throttle({ tight: { limit: 2, ttl: 60_000 } })
@Controller("partial-skip-route")
class PartialSkipController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe("Throttler integration", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: "default", limit: 3, ttl: 60_000 },
            { name: "tight", limit: 2, ttl: 60_000 },
          ],
        }),
      ],
      controllers: [DefaultRouteController, TightRouteController, SkippedRouteController, PartialSkipController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    (app as NestExpressApplication).set("trust proxy", 1);
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("emits X-RateLimit-* headers on a 200", async () => {
    const res = await request(app.getHttpServer()).get("/default-route");
    expect(res.status).toEqual(200);
    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
  });

  it("returns 429 with the standard error envelope after exceeding the default limit", async () => {
    const server = request(app.getHttpServer());
    await server.get("/default-route");
    await server.get("/default-route");
    await server.get("/default-route");
    const blocked = await server.get("/default-route");
    expect(blocked.status).toEqual(429);
    expect(blocked.body).toEqual(
      expect.objectContaining({
        statusCode: 429,
        error: "Too Many Requests",
        message: expect.any(String),
      }),
    );
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("applies the named override on tight-route and ignores the default bucket", async () => {
    const server = request(app.getHttpServer());
    await server.get("/tight-route");
    await server.get("/tight-route");
    const blocked = await server.get("/tight-route");
    expect(blocked.status).toEqual(429);
  });

  it("never throttles a route decorated with @SkipThrottle()", async () => {
    const server = request(app.getHttpServer());
    for (let i = 0; i < 10; i++) {
      const res = await server.get("/skip-route");
      expect(res.status).toEqual(200);
    }
  });

  it("documents v6 behavior: SkipThrottle({ default: true }) does NOT skip other named throttlers", async () => {
    // Regression guard: @nestjs/throttler v6 only skips the buckets explicitly listed.
    // A controller that wants to skip all throttlers must enumerate every name.
    // The health controller relies on this — see health.controller.ts.
    const server = request(app.getHttpServer());
    await server.get("/partial-skip-route");
    await server.get("/partial-skip-route");
    const blocked = await server.get("/partial-skip-route");
    expect(blocked.status).toEqual(429);
  });
});
