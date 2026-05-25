import { ThrottlerBehindProxyGuard } from "./throttler-behind-proxy.guard";

describe("ThrottlerBehindProxyGuard.getTracker", () => {
  const makeGuard = (): ThrottlerBehindProxyGuard => {
    // ThrottlerGuard's constructor params (options, storage, reflector) aren't
    // exercised by getTracker — we only test that one method in isolation.
    const stub = undefined as unknown as never;
    return new ThrottlerBehindProxyGuard(stub, stub, stub);
  };

  it("returns the leftmost forwarded IP when req.ips is populated", async () => {
    const guard = makeGuard();
    const req = { ip: "10.0.0.1", ips: ["203.0.113.5", "10.0.0.1"] };
    // @ts-expect-error — getTracker is protected; tests reach in deliberately
    await expect(guard.getTracker(req)).resolves.toEqual("203.0.113.5");
  });

  it("falls back to req.ip when req.ips is empty", async () => {
    const guard = makeGuard();
    const req = { ip: "203.0.113.10", ips: [] };
    // @ts-expect-error — protected reach
    await expect(guard.getTracker(req)).resolves.toEqual("203.0.113.10");
  });

  it("falls back to req.ip when req.ips is undefined", async () => {
    const guard = makeGuard();
    const req = { ip: "203.0.113.42" };
    // @ts-expect-error — protected reach
    await expect(guard.getTracker(req)).resolves.toEqual("203.0.113.42");
  });
});
