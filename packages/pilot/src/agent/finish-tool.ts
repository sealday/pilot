export type FinishStatus = "complete" | "blocked";

export type FinishPayload = {
  status: FinishStatus;
  summary: string;
  changedFiles: string[];
  verification: string[];
  risks: string[];
};

export function parseFinishPayload(input: unknown): FinishPayload {
  if (!isRecord(input)) {
    throw new Error("finish payload must be an object");
  }

  if (input.status !== "complete" && input.status !== "blocked") {
    throw new Error("invalid finish status");
  }

  return {
    status: input.status,
    summary: requiredTrimmedString(input.summary, "finish summary"),
    changedFiles: stringList(input.changedFiles, "finish changedFiles"),
    verification: stringList(input.verification, "finish verification"),
    risks: stringList(input.risks, "finish risks"),
  };
}

function requiredTrimmedString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function stringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${name} entries must be strings`);
    }

    return item.trim();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
