import { main as piCodingAgentMain } from "@earendil-works/pi-coding-agent";
import { workspacePiSessionDir } from "../storage/paths.js";

export type PiInteractiveRunner = (args: string[]) => Promise<void>;

export type PiInteractiveDeps = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  runner?: PiInteractiveRunner;
};

export function configurePiInteractiveEnv(deps: Pick<PiInteractiveDeps, "cwd" | "env"> = {}): void {
  const env = deps.env ?? process.env;

  if (!env.PI_CODING_AGENT_SESSION_DIR) {
    env.PI_CODING_AGENT_SESSION_DIR = workspacePiSessionDir({ cwd: deps.cwd });
  }
}

export async function runPiInteractive(args: string[] = [], deps: PiInteractiveDeps = {}): Promise<void> {
  configurePiInteractiveEnv(deps);
  await (deps.runner ?? piCodingAgentMain)(args);
}
