import { describe, expect, test } from "bun:test";
import { formatHelp } from "../src/cli/index.js";

describe("CLI help", () => {
  test("lists first-release commands", () => {
    const help = formatHelp();
    expect(help).toContain("pi-code auth login");
    expect(help).toContain("pi-code run [prompt]");
    expect(help).toContain("pi-code memory list");
  });
});
