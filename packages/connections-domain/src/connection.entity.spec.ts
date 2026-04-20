import { Connection, ConnectionProps } from "./connection.entity";
import { EncryptionError } from "./connection.errors";

const KEY = "a".repeat(64);
const baseProps: ConnectionProps = {
  businessId: "b-1",
  provider: "xero",
  accessToken: "plain-access",
  refreshToken: "plain-refresh",
  tokenExpiresAt: new Date("2030-01-01T00:00:00Z"),
  externalTenantId: "tenant-1",
  scopes: "a b c",
};

describe("Connection entity", () => {
  describe("create", () => {
    it("returns a Connection with encrypted tokens in format iv:tag:ct", () => {
      const conn = Connection.create(baseProps, KEY);

      expect(conn.businessId).toEqual("b-1");
      expect(conn.provider).toEqual("xero");
      expect(conn.externalTenantId).toEqual("tenant-1");
      expect(conn.scopes).toEqual("a b c");
      expect(conn.status).toEqual("connected");

      const accessParts = conn.encryptedAccessToken.split(":");
      const refreshParts = conn.encryptedRefreshToken.split(":");
      expect(accessParts).toHaveLength(3);
      expect(refreshParts).toHaveLength(3);
      expect(conn.encryptedAccessToken).not.toEqual("plain-access");
      expect(conn.encryptedRefreshToken).not.toEqual("plain-refresh");
    });

    it("wraps crypto failures in EncryptionError", () => {
      expect(() =>
        Connection.create(baseProps, "not-a-valid-hex-key"),
      ).toThrow(EncryptionError);
    });
  });

  describe("fromPersistence", () => {
    it("round-trips an encrypted connection back to plaintext", () => {
      const created = Connection.create(baseProps, KEY);

      const rehydrated = Connection.fromPersistence(
        {
          id: "c-1",
          businessId: created.businessId,
          provider: created.provider,
          encryptedAccessToken: created.encryptedAccessToken,
          encryptedRefreshToken: created.encryptedRefreshToken,
          tokenExpiresAt: created.tokenExpiresAt,
          externalTenantId: created.externalTenantId,
          scopes: created.scopes,
          status: created.status,
          lastRefreshAt: null,
          errorMessage: null,
        },
        KEY,
      );

      expect(rehydrated.accessToken).toEqual("plain-access");
      expect(rehydrated.refreshToken).toEqual("plain-refresh");
      expect(rehydrated.id).toEqual("c-1");
    });

    it("throws EncryptionError on tampered ciphertext", () => {
      const created = Connection.create(baseProps, KEY);
      const tampered = created.encryptedAccessToken.replace(/[0-9a-f]$/, "0");

      expect(() =>
        Connection.fromPersistence(
          {
            id: "c-2",
            businessId: created.businessId,
            provider: created.provider,
            encryptedAccessToken: tampered,
            encryptedRefreshToken: created.encryptedRefreshToken,
            tokenExpiresAt: created.tokenExpiresAt,
            externalTenantId: created.externalTenantId,
            scopes: created.scopes,
            status: created.status,
            lastRefreshAt: null,
            errorMessage: null,
          },
          KEY,
        ),
      ).toThrow(EncryptionError);
    });
  });

  describe("rotateTokens", () => {
    it("returns a new Connection with new encrypted tokens and bumped lastRefreshAt", () => {
      const before = Connection.create(baseProps, KEY);
      const persisted = Connection.fromPersistence(
        {
          id: "c-1",
          businessId: before.businessId,
          provider: before.provider,
          encryptedAccessToken: before.encryptedAccessToken,
          encryptedRefreshToken: before.encryptedRefreshToken,
          tokenExpiresAt: before.tokenExpiresAt,
          externalTenantId: before.externalTenantId,
          scopes: before.scopes,
          status: before.status,
          lastRefreshAt: null,
          errorMessage: "prior error",
        },
        KEY,
      );

      const rotated = persisted.rotateTokens(
        "new-access",
        "new-refresh",
        new Date("2031-01-01T00:00:00Z"),
      );

      expect(rotated.accessToken).toEqual("new-access");
      expect(rotated.refreshToken).toEqual("new-refresh");
      expect(rotated.tokenExpiresAt.toISOString()).toEqual("2031-01-01T00:00:00.000Z");
      expect(rotated.lastRefreshAt).not.toBeNull();
      expect(rotated.errorMessage).toBeNull();
      expect(rotated.status).toEqual("connected");
      expect(rotated.id).toEqual("c-1");
    });
  });

  describe("markRevoked / markExpired / markError", () => {
    it("markRevoked sets status and errorMessage, returns new instance", () => {
      const conn = Connection.create(baseProps, KEY);
      const revoked = conn.markRevoked("User revoked access");
      expect(revoked.status).toEqual("revoked");
      expect(revoked.errorMessage).toEqual("User revoked access");
      expect(conn.status).toEqual("connected"); // original unchanged
    });

    it("markExpired sets status to expired", () => {
      const conn = Connection.create(baseProps, KEY);
      const expired = conn.markExpired("Refresh token expired");
      expect(expired.status).toEqual("expired");
      expect(expired.errorMessage).toEqual("Refresh token expired");
    });

    it("markError sets status to error", () => {
      const conn = Connection.create(baseProps, KEY);
      const errored = conn.markError("Transient failure exhausted retries");
      expect(errored.status).toEqual("error");
      expect(errored.errorMessage).toEqual("Transient failure exhausted retries");
    });
  });
});
