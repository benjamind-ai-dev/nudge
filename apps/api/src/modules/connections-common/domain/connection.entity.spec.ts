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
          },
          KEY,
        ),
      ).toThrow(EncryptionError);
    });
  });
});
