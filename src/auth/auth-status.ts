export type AuthProblem =
  | "missing-login"
  | "expired"
  | "invalid-provider"
  | "invalid-auth-file"
  | "missing-api-key";

export type AuthStatus = {
  provider: "openai-codex" | "openai-api-key";
  source: "pi" | "env";
  authenticated: boolean;
  expiresAt?: string;
  accountHint?: string;
  problem?: AuthProblem;
};
