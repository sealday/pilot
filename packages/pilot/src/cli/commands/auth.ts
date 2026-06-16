import type { AuthStatus } from "../../auth/auth-status.js";
import { apiKeyFallbackStatus, type ApiKeyEnv } from "../../auth/api-key-fallback.js";
import { PiCodexAuthAdapter } from "../../auth/pi-codex-auth-adapter.js";
import { redactSecrets } from "../../auth/token-redaction.js";

export type AuthCommandResult = {
  exitCode: number;
  output: string;
};

export type AuthProvider = {
  status(now?: Date): Promise<AuthStatus>;
  login(): Promise<string>;
  logout(): Promise<string>;
};

export type AuthCommandDeps = {
  piAdapter?: AuthProvider;
  env?: ApiKeyEnv;
  now?: Date;
};

export async function authCommand(args: string[], deps: AuthCommandDeps = {}): Promise<AuthCommandResult> {
  const subcommand = args[0] ?? "status";
  const piAdapter = deps.piAdapter ?? new PiCodexAuthAdapter();

  if (subcommand === "status") {
    const piStatus = await piAdapter.status(deps.now);
    const status = piStatus.authenticated ? piStatus : apiKeyFallbackStatus(deps.env ?? process.env);
    const outputStatus = status.authenticated
      ? { ...status, ...(piStatus.authenticated ? {} : { piStatus }) }
      : {
          ...status,
          remediation: "Run `pi` interactively, then enter `/login` and choose OpenAI Codex auth.",
          piStatus,
        };

    return {
      exitCode: outputStatus.authenticated ? 0 : 1,
      output: JSON.stringify(outputStatus, null, 2),
    };
  }

  if (subcommand === "login") {
    return {
      exitCode: 0,
      output: await piAdapter.login(),
    };
  }

  if (subcommand === "logout") {
    return {
      exitCode: 0,
      output: await piAdapter.logout(),
    };
  }

  return {
    exitCode: 1,
    output: redactSecrets(`Unknown auth command: ${args.join(" ")}`),
  };
}
