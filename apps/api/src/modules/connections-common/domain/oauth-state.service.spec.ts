import Redis from "ioredis";
import { OAuthStateService, StatePayload } from "./oauth-state.service";

describe("OAuthStateService", () => {
  let redis: { set: jest.Mock; getdel: jest.Mock };
  let service: OAuthStateService;

  beforeEach(() => {
    redis = {
      set: jest.fn().mockResolvedValue("OK"),
      getdel: jest.fn(),
    };
    service = new OAuthStateService(redis as unknown as Redis);
  });

  describe("create", () => {
    it("returns a 64-char hex token", async () => {
      const payload: StatePayload = {
        businessId: "b-1",
        provider: "xero",
      };
      const token = await service.create(payload);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("stores JSON-encoded payload under oauth:state:<token> with 600s TTL", async () => {
      await service.create({ businessId: "b-1", provider: "quickbooks" });

      expect(redis.set).toHaveBeenCalledTimes(1);
      const [key, value, mode, ttl] = redis.set.mock.calls[0];
      expect(key).toMatch(/^oauth:state:[a-f0-9]{64}$/);
      expect(JSON.parse(value)).toEqual({
        businessId: "b-1",
        provider: "quickbooks",
      });
      expect(mode).toEqual("EX");
      expect(ttl).toEqual(600);
    });

    it("generates unique tokens across calls", async () => {
      const a = await service.create({ businessId: "b-1", provider: "xero" });
      const b = await service.create({ businessId: "b-1", provider: "xero" });
      expect(a).not.toEqual(b);
    });
  });

  describe("consume", () => {
    it("returns parsed payload and relies on GETDEL for atomic single-use", async () => {
      redis.getdel.mockResolvedValue(
        JSON.stringify({ businessId: "b-1", provider: "xero" }),
      );

      const payload = await service.consume("abc");

      expect(redis.getdel).toHaveBeenCalledWith("oauth:state:abc");
      expect(payload).toEqual({ businessId: "b-1", provider: "xero" });
    });

    it("returns null when Redis has no matching key", async () => {
      redis.getdel.mockResolvedValue(null);
      expect(await service.consume("abc")).toBeNull();
    });

    it("returns null when stored value is not valid JSON", async () => {
      redis.getdel.mockResolvedValue("not-json");
      expect(await service.consume("abc")).toBeNull();
    });
  });
});
