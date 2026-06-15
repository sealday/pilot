import { SessionRunner, type SessionRunnerDeps } from "../../agent/session-runner.js";

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
      output: "Usage: pi-code run [prompt]",
    };
  }

  const result = await new SessionRunner(deps).run(prompt);
  return {
    exitCode: result.status === "complete" ? 0 : 1,
    output: JSON.stringify(result, null, 2),
  };
}
