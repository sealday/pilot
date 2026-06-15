export function hasConflict(candidate: string, existing: string[]): boolean {
  const candidateForms = contradictionForms(candidate);

  if (candidateForms.length === 0) {
    return false;
  }

  return existing.some((item) => {
    const existingForms = contradictionForms(item);

    if (existingForms.length === 0) {
      return false;
    }

    return candidateForms.some((candidateForm) =>
      existingForms.some(
        (existingForm) =>
          candidateForm.normalized === existingForm.normalized && candidateForm.negated !== existingForm.negated,
      ),
    );
  });
}

type ContradictionForm = {
  normalized: string;
  negated: boolean;
};

function contradictionForms(value: string): ContradictionForm[] {
  const normalized = normalize(value);
  const positive = normalized.replace(/\bnot\b/g, "").replace(/\s+/g, " ").trim();

  if (positive === normalized) {
    return [{ normalized, negated: false }];
  }

  return [{ normalized: positive, negated: true }];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
