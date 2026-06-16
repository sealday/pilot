const REDACTED = "[REDACTED]";

const PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\brt_[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\b/g,
  /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

export function redactSecrets(value: unknown): string {
  let text = stringifyForRedaction(value);

  for (const pattern of PATTERNS) {
    text = text.replace(pattern, REDACTED);
  }

  return text;
}

function stringifyForRedaction(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
