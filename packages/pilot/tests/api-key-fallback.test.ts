import { describe, expect, test } from "bun:test";
import { apiKeyFallbackStatus } from "../src/auth/api-key-fallback.js";

describe("apiKeyFallbackStatus", () => {
  test("reports present OPENAI_API_KEY without exposing it", () => {
    const status = apiKeyFallbackStatus({ OPENAI_API_KEY: "sk-test123456789" });

    expect(status.authenticated).toBe(true);
    expect(status.source).toBe("env");
    expect(status.provider).toBe("openai-api-key");
    expect(JSON.stringify(status)).not.toContain("sk-test123456789");
  });

  test("reports missing OPENAI_API_KEY", () => {
    const status = apiKeyFallbackStatus({});

    expect(status.authenticated).toBe(false);
    expect(status.source).toBe("env");
    expect(status.problem).toBe("missing-api-key");
  });
});
