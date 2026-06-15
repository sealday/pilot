export type UsageInput = {
  input?: number;
  output?: number;
  cacheRead?: number;
};

export type UsageSummary = {
  input: number;
  output: number;
  cacheRead: number;
  total: number;
};

export function normalizeUsage(usage: UsageInput): UsageSummary {
  const input = usage.input ?? 0;
  const output = usage.output ?? 0;
  const cacheRead = usage.cacheRead ?? 0;

  return {
    input,
    output,
    cacheRead,
    total: input + output,
  };
}
