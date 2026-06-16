export function similarity(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : intersection / union;
}

export function isDuplicate(candidate: string, existing: string[], threshold = 0.8): boolean {
  return existing.some((item) => similarity(candidate, item) >= threshold);
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/\s+/).filter(Boolean));
}
