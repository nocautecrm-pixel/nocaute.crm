import type { ParseCustomerResult } from "@/lib/customers/parse-sheet";
import type { ImportCandidate, ImportMethod } from "@/lib/customers/import-agent/types";

export function scoreParseResult(result: ParseCustomerResult): number {
  const rows = result.rows.length;
  if (rows === 0) return 0;
  const attempted = rows + result.invalid;
  const ratio = attempted > 0 ? rows / attempted : 0;
  return rows * 12 + ratio * 40 - Math.min(result.invalid, 20) * 1.5;
}

export function toCandidate(
  method: ImportMethod,
  result: ParseCustomerResult,
  notes: string[] = [],
): ImportCandidate {
  return {
    ...result,
    method,
    confidence: Math.min(99, Math.round(scoreParseResult(result))),
    notes,
  };
}

export function pickBestCandidate(candidates: ImportCandidate[]): ImportCandidate | null {
  const usable = candidates.filter((item) => item.rows.length > 0);
  if (usable.length === 0) return null;
  usable.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.rows.length - a.rows.length;
  });
  return usable[0];
}
