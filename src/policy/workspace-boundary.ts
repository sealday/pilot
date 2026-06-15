import path from "node:path";

export function isInsideWorkspace(workspace: string, target: string): boolean {
  const pathApi = usesWindowsPath(workspace) || usesWindowsPath(target) ? path.win32 : path;
  const workspaceRoot = pathApi.resolve(workspace);
  const targetPath = pathApi.resolve(target);
  const relativePath = pathApi.relative(workspaceRoot, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath))
  );
}

function usesWindowsPath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\");
}
