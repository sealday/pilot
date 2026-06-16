import { SessionRunner, type SessionRunnerDeps } from "../../agent/session-runner.js";
import { redactSecrets } from "../../auth/token-redaction.js";
import type { SessionResult } from "../../agent/session-runner.js";

export type RunCommandResult = {
  exitCode: number;
  output: string;
};

export type RunCommandDeps = SessionRunnerDeps;

export async function runCommand(args: string[], deps: RunCommandDeps = {}): Promise<RunCommandResult> {
  const prompt = args.join(" ").trim();

  if (prompt.length === 0) {
    return {
      exitCode: 1,
      output: "Usage: pilot run [prompt]",
    };
  }

  const result = await new SessionRunner(deps).run(prompt);
  return {
    exitCode: result.status === "complete" ? 0 : 1,
    output: redactSecrets(JSON.stringify(formatRunOutput(result), null, 2)),
  };
}

function formatRunOutput(result: SessionResult) {
  return {
    status: result.status,
    sessionId: result.sessionId,
    summary: result.summary,
    changedFiles: result.changedFiles,
    verification: result.verification,
    risks: result.risks,
    todos: result.todos,
  };
}
