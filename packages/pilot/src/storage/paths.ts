import { homedir } from "node:os";
import { join } from "node:path";

export type PathDeps = {
  homeDir?: string;
  cwd?: string;
};

export function expandHome(path: string, deps: PathDeps = {}): string {
  const homeDir = deps.homeDir ?? homedir();

  if (path === "~") {
    return homeDir;
  }

  if (path.startsWith("~/")) {
    return join(homeDir, path.slice(2));
  }

  return path;
}

export function piAuthPath(deps: PathDeps = {}): string {
  return join(deps.homeDir ?? homedir(), ".pi", "agent", "auth.json");
}

export function piCodeConfigDir(deps: PathDeps = {}): string {
  return join(deps.homeDir ?? homedir(), ".pi-code");
}

export function workspaceSessionDir(deps: PathDeps = {}): string {
  return join(deps.cwd ?? process.cwd(), ".pi-code", "sessions");
}
