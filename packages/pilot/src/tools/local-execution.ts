import { lstat, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { devNull } from "node:os";
import { join, relative, resolve } from "node:path";
import { decisionForShellRisk } from "../policy/permissions.js";
import { isInsideWorkspace } from "../policy/workspace-boundary.js";
import { classifyShellCommand } from "./shell.js";

const TEXT_SNIPPET_LIMIT = 8_000;
const SEARCH_RESULT_LIMIT = 100;
const COMMAND_OUTPUT_LIMIT = 12_000;
const WEB_SNIPPET_LIMIT = 4_000;
const SAFE_GIT_STATUS_OPTIONS = new Set([
  "--short",
  "-s",
  "--porcelain",
  "--porcelain=v1",
  "--porcelain=v2",
  "--branch",
  "-b",
  "--untracked-files",
  "--untracked-files=all",
  "--untracked-files=normal",
  "--untracked-files=no",
]);
const SAFE_GIT_DIFF_OPTIONS = new Set([
  "--",
  "--cached",
  "--staged",
  "--check",
  "--stat",
  "--shortstat",
  "--name-only",
  "--name-status",
  "--color=never",
  "--no-color",
]);

export type LocalToolDeps = {
  fetch?: typeof fetch;
};

export type LocalToolContext = {
  workspace: string;
  deps?: LocalToolDeps;
};

export async function fileRead(input: unknown, context: LocalToolContext): Promise<{ path: string; content: string }> {
  const path = await workspacePath(input, context.workspace);
  const content = await readFile(path.absolutePath, "utf8");
  return { path: path.relativePath, content: snippet(content, TEXT_SNIPPET_LIMIT) };
}

export async function patchEdit(
  input: unknown,
  context: LocalToolContext,
): Promise<{ changedPath: string; replacements: number }> {
  const payload = objectInput(input);
  const path = await workspacePath(payload, context.workspace);
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
  if (decision !== "allow" || !(await isAllowedReadOnlyShellCommand(command, context.workspace))) {
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
  const root = await workspacePath({ path: optionalString(payload.path) ?? "." }, context.workspace);
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
  validateGitArgs(args, context.workspace);

  const result = await runCommand(["git", ...hardenGitArgs(args)], context.workspace, { env: hardenedGitEnv() });
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

async function workspacePath(input: unknown, workspace: string): Promise<{ absolutePath: string; relativePath: string }> {
  const payload = objectInput(input);
  const rawPath = requiredString(payload.path, "path");
  const absolutePath = resolve(workspace, rawPath);
  if (!isInsideWorkspace(workspace, absolutePath)) {
    throw new Error("path escapes workspace");
  }

  await assertRealPathInsideWorkspace(absolutePath, workspace, "path");
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
  await assertRealPathInsideWorkspace(root, workspace, "search path");

  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".pilot") {
      continue;
    }

    const absolutePath = join(root, entry.name);
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) {
      continue;
    }

    if (stats.isDirectory()) {
      files.push(...await listWorkspaceFiles(absolutePath, workspace));
    } else if (stats.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function assertRealPathInsideWorkspace(absolutePath: string, workspace: string, label: string): Promise<void> {
  const stats = await lstat(absolutePath);
  if (stats.isSymbolicLink()) {
    throw new Error(`${label} cannot be a symlink`);
  }

  const [workspaceRealPath, targetRealPath] = await Promise.all([realpath(workspace), realpath(absolutePath)]);
  if (!isInsideWorkspace(workspaceRealPath, targetRealPath)) {
    throw new Error(`${label} escapes workspace`);
  }
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

async function isAllowedReadOnlyShellCommand(command: string, workspace: string): Promise<boolean> {
  const trimmed = command.trim();
  if (trimmed.length === 0 || /[<>&|;`$"'\\\r\n]/.test(trimmed)) {
    return false;
  }

  const tokens = trimmed.split(/\s+/);
  const executable = tokens[0];
  const args = tokens.slice(1);
  if (executable === "pwd") {
    return args.length === 0;
  }

  if (executable === "ls") {
    return areAllowedShellPathArgs(args.filter((arg) => !arg.startsWith("-")), workspace);
  }

  if (executable === "cat") {
    return args.length > 0 && areAllowedShellPathArgs(args, workspace);
  }

  if (executable === "test") {
    return args.length === 2 && ["-f", "-r", "-s"].includes(args[0] ?? "") && isAllowedShellPathArg(args[1] ?? "", workspace);
  }

  if (executable === "grep") {
    const options = args.filter((arg) => arg.startsWith("-"));
    if (!options.every((option) => option === "-q" || option === "-n")) {
      return false;
    }

    const positional = args.filter((arg) => !arg.startsWith("-"));
    if (positional.length < 2) {
      return false;
    }

    return areAllowedShellPathArgs(positional.slice(1), workspace);
  }

  return false;
}

async function areAllowedShellPathArgs(args: string[], workspace: string): Promise<boolean> {
  for (const arg of args) {
    if (!(await isAllowedShellPathArg(arg, workspace))) {
      return false;
    }
  }

  return true;
}

async function isAllowedShellPathArg(arg: string, workspace: string): Promise<boolean> {
  if (arg.length === 0 || arg.startsWith("-")) {
    return false;
  }

  const absolutePath = resolve(workspace, arg);
  if (!isInsideWorkspace(workspace, absolutePath)) {
    return false;
  }

  try {
    await assertRealPathInsideWorkspace(absolutePath, workspace, "shell path");
    return true;
  } catch {
    return false;
  }
}

function validateGitArgs(args: string[], workspace: string): void {
  const gitCommand = args[0];
  const rest = args.slice(1);
  if (gitCommand === "status") {
    validateGitStatusArgs(rest, workspace);
    return;
  }

  if (gitCommand === "diff") {
    validateGitDiffArgs(rest, workspace);
    return;
  }

  throw new Error("git tool only supports safe read-only status/diff style operations");
}

function validateGitStatusArgs(args: string[], workspace: string): void {
  let pathMode = false;
  for (const arg of args) {
    if (arg === "--") {
      pathMode = true;
      continue;
    }

    if (!pathMode && arg.startsWith("-")) {
      if (!SAFE_GIT_STATUS_OPTIONS.has(arg)) {
        throw new Error(`unsupported git status option: ${arg}`);
      }
      continue;
    }

    validateGitPathArg(arg, workspace);
  }
}

function validateGitDiffArgs(args: string[], workspace: string): void {
  let pathMode = false;
  for (const arg of args) {
    if (arg === "--") {
      pathMode = true;
      continue;
    }

    if (!pathMode && arg.startsWith("-")) {
      if (arg === "--no-index" || arg === "--output" || arg.startsWith("--output=")) {
        throw new Error(`unsupported git diff option: ${arg}`);
      }

      if (!SAFE_GIT_DIFF_OPTIONS.has(arg) && !/^-U\d+$/.test(arg)) {
        throw new Error(`unsupported git diff option: ${arg}`);
      }
      continue;
    }

    validateGitPathArg(arg, workspace);
  }
}

function validateGitPathArg(arg: string, workspace: string): void {
  if (arg.includes(":")) {
    throw new Error(`git path argument is not a workspace path: ${arg}`);
  }

  const absolutePath = resolve(workspace, arg);
  if (!isInsideWorkspace(workspace, absolutePath)) {
    throw new Error(`git path argument escapes workspace: ${arg}`);
  }
}

function hardenGitArgs(args: string[]): string[] {
  const gitCommand = args[0];
  const rest = args.slice(1);
  const common = [
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    "-c",
    "diff.external=",
  ];

  if (gitCommand === "diff") {
    return [...common, "diff", "--no-ext-diff", "--no-textconv", ...rest];
  }

  return [...common, ...args];
}

function hardenedGitEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  delete env.GIT_EXTERNAL_DIFF;
  env.GIT_CONFIG_GLOBAL = devNull;
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_OPTIONAL_LOCKS = "0";
  env.GIT_PAGER = "cat";
  env.GIT_TERMINAL_PROMPT = "0";
  env.PAGER = "cat";
  return env;
}

async function runCommand(
  command: string[],
  cwd: string,
  options: { env?: Record<string, string> } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc =
    options.env === undefined
      ? Bun.spawn(command, {
          cwd,
          stdout: "pipe",
          stderr: "pipe",
        })
      : Bun.spawn(command, {
          cwd,
          env: options.env,
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
