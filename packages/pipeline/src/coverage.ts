import type { Coverage, Question, Requirement } from '@prepkit/schema';

/**
 * Deterministic coverage check - this is application logic, never an LLM
 * decision (brief §12/§16). A must-have requirement is "covered" the moment
 * any non-deleted question cites its id in `requirement_ids`.
 */
export function calculateCoverage(
  requirements: Requirement[],
  questions: Question[],
): Coverage & { covered_count: number; total_must_count: number; coverage_percent: number } {
  const mustIds = requirements.filter((r) => r.priority === 'must' && !r.deleted).map((r) => r.id);

  const coveredIds = new Set<string>();
  for (const q of questions) {
    if (q.deleted) continue;
    for (const rid of q.requirement_ids) coveredIds.add(rid);
  }

  const uncovered = mustIds.filter((id) => !coveredIds.has(id));
  const totalMustCount = mustIds.length;
  const coveredCount = totalMustCount - uncovered.length;

  return {
    uncovered_requirement_ids: uncovered,
    passes: 0, // caller (orchestrator) fills in the actual pass count it ran
    covered_count: coveredCount,
    total_must_count: totalMustCount,
    coverage_percent:
      totalMustCount === 0 ? 100 : Math.round((100 * coveredCount) / totalMustCount),
  };
}

export function isFullyCovered(requirements: Requirement[], questions: Question[]): boolean {
  return calculateCoverage(requirements, questions).uncovered_requirement_ids.length === 0;
}
