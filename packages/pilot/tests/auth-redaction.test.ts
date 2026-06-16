import { describe, expect, test } from "bun:test";
import { redactSecrets } from "../src/auth/token-redaction.js";

describe("redactSecrets", () => {
  test("redacts OpenAI-style API keys", () => {
    const value = redactSecrets("key=sk-test123456789");

    expect(value).toContain("[REDACTED]");
    expect(value).not.toContain("sk-test123456789");
  });

  test("redacts refresh tokens", () => {
    const value = redactSecrets("refresh=rt_abc.def other=rt_secret.secret");

    expect(value).toContain("[REDACTED]");
    expect(value).not.toContain("rt_abc.def");
    expect(value).not.toContain("rt_secret.secret");
  });

  test("redacts JWT-like tokens", () => {
    const value = redactSecrets("tokens aaa.bbb.ccc eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature");

    expect(value).toContain("[REDACTED]");
    expect(value).not.toContain("aaa.bbb.ccc");
    expect(value).not.toContain("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature");
  });

  test("redacts Error messages", () => {
    const value = redactSecrets(new Error("failed with sk-test123456789"));

    expect(value).toContain("[REDACTED]");
    expect(value).not.toContain("sk-test123456789");
  });

  test("does not throw on BigInt input", () => {
    expect(redactSecrets(123n)).toBe("123");
  });
});
