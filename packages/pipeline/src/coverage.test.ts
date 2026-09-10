import { describe, expect, it } from 'vitest';
import type { Question, Requirement } from '@prepkit/schema';
import { calculateCoverage, isFullyCovered } from './coverage.js';

function req(id: string, priority: 'must' | 'nice', deleted = false): Requirement {
  return {
    id,
    text: `requirement ${id}`,
    kind: 'technical',
    priority,
    origin: 'generated',
    deleted,
  };
}

function q(id: string, requirement_ids: string[], deleted = false): Question {
  return {
    id,
    requirement_ids,
    category: 'technical',
    prompt: `prompt ${id}`,
    answer_outline: 'outline',
    difficulty: 2,
    origin: 'generated',
    isEdited: false,
    isPinned: false,
    deleted,
    version: 1,
    order: 0,
  };
}

describe('calculateCoverage', () => {
  it('reports full coverage when every must requirement has a question', () => {
    const requirements = [req('r1', 'must'), req('r2', 'must'), req('r3', 'nice')];
    const questions = [q('q1', ['r1']), q('q2', ['r2'])];
    const coverage = calculateCoverage(requirements, questions);
    expect(coverage.uncovered_requirement_ids).toEqual([]);
    expect(coverage.covered_count).toBe(2);
    expect(coverage.total_must_count).toBe(2);
    expect(coverage.coverage_percent).toBe(100);
  });

  it('flags must requirements with no covering question', () => {
    const requirements = [req('r1', 'must'), req('r2', 'must')];
    const questions = [q('q1', ['r1'])];
    const coverage = calculateCoverage(requirements, questions);
    expect(coverage.uncovered_requirement_ids).toEqual(['r2']);
    expect(coverage.coverage_percent).toBe(50);
  });

  it('ignores nice-to-have requirements entirely', () => {
    const requirements = [req('r1', 'nice')];
    const questions: Question[] = [];
    const coverage = calculateCoverage(requirements, questions);
    expect(coverage.total_must_count).toBe(0);
    expect(coverage.coverage_percent).toBe(100);
    expect(isFullyCovered(requirements, questions)).toBe(true);
  });

  it('does not count a deleted question as coverage', () => {
    const requirements = [req('r1', 'must')];
    const questions = [q('q1', ['r1'], true)];
    const coverage = calculateCoverage(requirements, questions);
    expect(coverage.uncovered_requirement_ids).toEqual(['r1']);
  });

  it('does not require coverage for a deleted requirement', () => {
    const requirements = [req('r1', 'must', true)];
    const questions: Question[] = [];
    expect(isFullyCovered(requirements, questions)).toBe(true);
  });

  it('handles zero requirements as fully covered', () => {
    expect(calculateCoverage([], []).coverage_percent).toBe(100);
  });
});
