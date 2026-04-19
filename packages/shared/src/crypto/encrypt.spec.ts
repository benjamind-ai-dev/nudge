import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encrypt";
import { randomBytes } from "crypto";

// Valid 32-byte key as 64-char hex string
const TEST_KEY = randomBytes(32).toString("hex");

describe("encrypt", () => {
  it("returns a string in iv:authTag:ciphertext format", () => {
    const result = encrypt("hello world", TEST_KEY);
    const parts = result.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext is non-empty hex
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const a = encrypt("same input", TEST_KEY);
    const b = encrypt("same input", TEST_KEY);
    expect(a).not.toEqual(b);
  });
});

describe("decrypt", () => {
  it("round-trips with encrypt", () => {
    const plaintext = "sensitive token value";
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toEqual(plaintext);
  });

  it("round-trips with empty string", () => {
    const encrypted = encrypt("", TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toEqual("");
  });

  it("round-trips with unicode", () => {
    const plaintext = "token-with-émojis-🔑";
    const encrypted = encrypt(plaintext, TEST_KEY);
    expect(decrypt(encrypted, TEST_KEY)).toEqual(plaintext);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("hello", TEST_KEY);
    const parts = encrypted.split(":");
    // Flip a character in the ciphertext
    const tampered = parts[0] + ":" + parts[1] + ":" + "ff" + parts[2].slice(2);
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it("throws on wrong key", () => {
    const encrypted = encrypt("hello", TEST_KEY);
    const wrongKey = randomBytes(32).toString("hex");
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("throws on malformed input", () => {
    expect(() => decrypt("not-valid-format", TEST_KEY)).toThrow();
  });
});
