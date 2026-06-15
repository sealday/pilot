import path from "node:path";

export function isInsideWorkspace(workspace: string, target: string): boolean {
  const workspaceIsWindows = isWindowsAbsolutePath(workspace);
  const targetIsWindows = isWindowsAbsolutePath(target);

  if (workspaceIsWindows !== targetIsWindows) {
    return false;
  }

  if (!workspaceIsWindows && target.includes("\\")) {
    return false;
  }

  const pathApi = workspaceIsWindows ? path.win32 : path.posix;
  const workspaceRoot = pathApi.resolve(workspace);
  const targetPath = pathApi.resolve(target);
  const relativePath = pathApi.relative(workspaceRoot, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath))
  );
}

function isWindowsAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}
