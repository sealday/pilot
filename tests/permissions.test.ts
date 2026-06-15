import { describe, expect, test } from "bun:test";
import { decisionForShellRisk } from "../src/policy/permissions.js";
import { classifyShellCommand } from "../src/tools/shell.js";

describe("classifyShellCommand", () => {
  test("classifies read-only commands as safe", () => {
    expect(classifyShellCommand("git status")).toBe("safe");
    expect(classifyShellCommand("rg pattern")).toBe("safe");
    expect(classifyShellCommand("ls")).toBe("safe");
  });

  test("classifies workspace-changing commands as mutating", () => {
    expect(classifyShellCommand("bun install")).toBe("mutating");
    expect(classifyShellCommand("npm install")).toBe("mutating");
    expect(classifyShellCommand("pnpm install")).toBe("mutating");
    expect(classifyShellCommand("yarn add typescript")).toBe("mutating");
    expect(classifyShellCommand("git commit -m test")).toBe("mutating");
    expect(classifyShellCommand("git checkout feature")).toBe("mutating");
    expect(classifyShellCommand("git reset HEAD~1")).toBe("mutating");
    expect(classifyShellCommand("mv a b")).toBe("mutating");
    expect(classifyShellCommand("cp a b")).toBe("mutating");
    expect(classifyShellCommand("touch file.ts")).toBe("mutating");
    expect(classifyShellCommand("mkdir src/policy")).toBe("mutating");
  });

  test("classifies destructive or system-level commands as dangerous", () => {
    expect(classifyShellCommand("rm -rf /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("rm -fr /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("rm -r -f /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("rm -f -r /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("  RM   -r   -f   /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("chmod -R 777 /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("chown -R root /tmp/example")).toBe("dangerous");
    expect(classifyShellCommand("dd if=/dev/zero of=/tmp/blob")).toBe("dangerous");
    expect(classifyShellCommand("mkfs.ext4 /dev/disk1")).toBe("dangerous");
    expect(classifyShellCommand("shutdown now")).toBe("dangerous");
    expect(classifyShellCommand("reboot")).toBe("dangerous");
  });
});

describe("decisionForShellRisk", () => {
  test("allows safe commands regardless of attendance", () => {
    expect(decisionForShellRisk("safe", false)).toBe("allow");
    expect(decisionForShellRisk("safe", true)).toBe("allow");
  });

  test("asks before mutating or dangerous commands when attended", () => {
    expect(decisionForShellRisk("mutating", false)).toBe("ask");
    expect(decisionForShellRisk("dangerous", false)).toBe("ask");
  });

  test("denies mutating or dangerous commands when unattended", () => {
    expect(decisionForShellRisk("mutating", true)).toBe("deny");
    expect(decisionForShellRisk("dangerous", true)).toBe("deny");
  });
});
