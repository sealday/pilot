import type { AuthStatus } from "./auth-status.js";

export type ApiKeyEnv = Record<string, string | undefined>;

export function apiKeyFallbackStatus(env: ApiKeyEnv = process.env): AuthStatus {
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
    return {
      provider: "openai-api-key",
      source: "env",
      authenticated: true,
      accountHint: "OPENAI_API_KEY",
    };
  }

  return {
    provider: "openai-api-key",
    source: "env",
    authenticated: false,
    problem: "missing-api-key",
  };
}
