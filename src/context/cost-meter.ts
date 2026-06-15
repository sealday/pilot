export type UsageInput = {
  input?: unknown;
  output?: unknown;
  cacheRead?: unknown;
};

export type UsageSummary = {
  input: number;
  output: number;
  cacheRead: number;
  total: number;
};

export function normalizeUsage(usage: UsageInput): UsageSummary {
  const input = normalizeUsageField(usage.input);
  const output = normalizeUsageField(usage.output);
  const cacheRead = normalizeUsageField(usage.cacheRead);

  return {
    input,
    output,
    cacheRead,
    total: input + output,
  };
}

function normalizeUsageField(value: unknown): number {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return number;
}
