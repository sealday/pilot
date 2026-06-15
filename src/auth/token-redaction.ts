const REDACTED = "[REDACTED]";

const PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\brt_[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\b/g,
  /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

export function redactSecrets(value: unknown): string {
  let text = typeof value === "string" ? value : JSON.stringify(value);

  if (text === undefined) {
    text = String(value);
  }

  for (const pattern of PATTERNS) {
    text = text.replace(pattern, REDACTED);
  }

  return text;
}
