export type Confidence = "low" | "medium" | "high";

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type MemoryCandidate = {
  confidence: Confidence;
  explicit: boolean;
};

export function shouldAcceptMemory(candidate: MemoryCandidate, floor: Confidence): boolean {
  return candidate.explicit || CONFIDENCE_RANK[candidate.confidence] >= CONFIDENCE_RANK[floor];
}
