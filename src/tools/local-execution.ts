import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { decisionForShellRisk } from "../policy/permissions.js";
import { isInsideWorkspace } from "../policy/workspace-boundary.js";
import { classifyShellCommand } from "./shell.js";

const TEXT_SNIPPET_LIMIT = 8_000;
const SEARCH_RESULT_LIMIT = 100;
const COMMAND_OUTPUT_LIMIT = 12_000;
const WEB_SNIPPET_LIMIT = 4_000;
const SAFE_GIT_COMMANDS = new Set(["status", "diff", "show", "log", "rev-parse", "branch"]);

export type LocalToolDeps = {
  fetch?: typeof fetch;
};

export type LocalToolContext = {
  workspace: string;
  deps?: LocalToolDeps;
};

export async function fileRead(input: unknown, context: LocalToolContext): Promise<{ path: string; content: string }> {
  const path = workspacePath(input, context.workspace);
  const content = await readFile(path.absolutePath, "utf8");
  return { path: path.relativePath, content: snippet(content, TEXT_SNIPPET_LIMIT) };
}

export async function patchEdit(
  input: unknown,
  context: LocalToolContext,
): Promise<{ changedPath: string; replacements: number }> {
  const payload = objectInput(input);
  const path = workspacePath(payload, context.workspace);
  const search = requiredString(payload.search, "patch_edit search");
  const replace = requiredString(payload.replace, "patch_edit replace");
  if (search.length === 0) {
    throw new Error("patch_edit search is required");
  }

  const before = await readFile(path.absolutePath, "utf8");
  const replacements = before.split(search).length - 1;
  if (replacements === 0) {
    throw new Error("patch_edit search text was not found");
  }

  await writeFile(path.absolutePath, before.split(search).join(replace), "utf8");
  return { changedPath: path.relativePath, replacements };
}

export async function shellExecute(
  input: unknown,
  context: LocalToolContext,
): Promise<{ command: string; risk: string; exitCode: number; stdout: string; stderr: string }> {
  const payload = objectInput(input);
  const command = requiredString(payload.command, "shell command");
  const risk = classifyShellCommand(command);
  const decision = decisionForShellRisk(risk, true);
  if (decision !== "allow") {
    throw new Error(`shell command rejected by policy: ${risk}`);
  }

  const result = await runCommand(["sh", "-c", command], context.workspace);
  return { command, risk, ...result };
}

export async function grepSearch(
  input: unknown,
  context: LocalToolContext,
): Promise<{ matches: Array<{ path: string; line: number; text: string }> }> {
  const payload = objectInput(input);
  const pattern = requiredString(payload.pattern, "grep pattern");
  const root = workspacePath({ path: optionalString(payload.path) ?? "." }, context.workspace);
  const files = await listWorkspaceFiles(root.absolutePath, context.workspace);
  const matches: Array<{ path: string; line: number; text: string }> = [];

  for (const file of files) {
    const content = await readFile(file, "utf8").catch(() => null);
    if (content === null) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (line.includes(pattern)) {
        matches.push({ path: toWorkspaceRelative(context.workspace, file), line: index + 1, text: line });
        if (matches.length >= SEARCH_RESULT_LIMIT) {
          return { matches };
        }
      }
    }
  }

  return { matches };
}

export async function globSearch(input: unknown, context: LocalToolContext): Promise<{ paths: string[] }> {
  const payload = objectInput(input);
  const pattern = requiredString(payload.pattern, "glob pattern");
  if (pattern.includes("..")) {
    throw new Error("glob pattern must stay inside the workspace");
  }

  const files = await listWorkspaceFiles(context.workspace, context.workspace);
  const matcher = globToRegExp(pattern);
  return {
    paths: files.map((file) => toWorkspaceRelative(context.workspace, file)).filter((path) => matcher.test(path)),
  };
}

export async function gitRead(
  input: unknown,
  context: LocalToolContext,
): Promise<{ args: string[]; exitCode: number; stdout: string; stderr: string }> {
  const payload = objectInput(input);
  const args = parseGitArgs(payload);
  const gitCommand = args[0];
  if (gitCommand === undefined || !SAFE_GIT_COMMANDS.has(gitCommand)) {
    throw new Error("git tool only supports safe read-only status/diff style operations");
  }

  const unsafePathArg = args.find((arg) => looksLikeEscapingPathArg(arg, context.workspace));
  if (unsafePathArg !== undefined) {
    throw new Error(`git path argument escapes workspace: ${unsafePathArg}`);
  }

  const result = await runCommand(["git", ...args], context.workspace);
  return { args, ...result };
}

export async function webFetch(
  input: unknown,
  context: LocalToolContext,
): Promise<{ url: string; status: number; text: string }> {
  const payload = objectInput(input);
  const url = requiredString(payload.url, "web_fetch url");
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("web_fetch only supports http and https URLs");
  }

  const fetchImpl = context.deps?.fetch ?? fetch;
  const response = await fetchImpl(parsed);
  const text = await response.text();
  return { url: parsed.toString(), status: response.status, text: snippet(text, WEB_SNIPPET_LIMIT) };
}

function workspacePath(input: unknown, workspace: string): { absolutePath: string; relativePath: string } {
  const payload = objectInput(input);
  const rawPath = requiredString(payload.path, "path");
  const absolutePath = resolve(workspace, rawPath);
  if (!isInsideWorkspace(workspace, absolutePath)) {
    throw new Error("path escapes workspace");
  }

  return { absolutePath, relativePath: toWorkspaceRelative(workspace, absolutePath) };
}

function objectInput(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("tool input must be an object");
  }

  return input as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function listWorkspaceFiles(root: string, workspace: string): Promise<string[]> {
  if (!isInsideWorkspace(workspace, root)) {
    throw new Error("search path escapes workspace");
  }

  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".pi-code") {
      continue;
    }

    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listWorkspaceFiles(absolutePath, workspace));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? "";
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegExp(char);
    }
  }

  return new RegExp(`${source}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function parseGitArgs(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.args) && payload.args.every((arg) => typeof arg === "string")) {
    return payload.args;
  }

  if (typeof payload.command === "string") {
    return payload.command.trim().split(/\s+/).filter(Boolean);
  }

  throw new Error("git args must be a string array");
}

function looksLikeEscapingPathArg(arg: string, workspace: string): boolean {
  if (arg.startsWith("-") || arg.includes("=") || arg === "--") {
    return false;
  }

  if (!arg.includes("/") && basename(arg) === arg) {
    return false;
  }

  return !isInsideWorkspace(workspace, resolve(workspace, arg));
}

async function runCommand(
  command: string[],
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout: snippet(stdout, COMMAND_OUTPUT_LIMIT),
    stderr: snippet(stderr, COMMAND_OUTPUT_LIMIT),
  };
}

function snippet(value: string, limit: number): string {
  return value.length > limit ? value.slice(0, limit) : value;
}

function toWorkspaceRelative(workspace: string, absolutePath: string): string {
  return relative(workspace, absolutePath).split("\\").join("/");
}
