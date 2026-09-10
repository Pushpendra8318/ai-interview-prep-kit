import { describe, expect, it } from 'vitest';
import type { Question, QuestionCategory, Requirement } from '@prepkit/schema';
import { allocateSchedule } from './schedule.js';

function req(id: string, priority: 'must' | 'nice'): Requirement {
  return {
    id,
    text: `req ${id}`,
    kind: 'technical',
    priority,
    origin: 'generated',
    deleted: false,
  };
}

function q(
  id: string,
  requirement_ids: string[],
  difficulty: 1 | 2 | 3 = 2,
  category: QuestionCategory = 'technical',
): Question {
  return {
    id,
    requirement_ids,
    category,
    prompt: `prompt ${id}`,
    answer_outline: 'outline',
    difficulty,
    origin: 'generated',
    isEdited: false,
    isPinned: false,
    deleted: false,
    version: 1,
    order: 0,
  };
}

function allQuestionIds(questions: Question[]): Set<string> {
  return new Set(questions.map((qq) => qq.id));
}

function assertBasicInvariants(
  schedule: ReturnType<typeof allocateSchedule>,
  daysAvailable: number,
  questions: Question[],
) {
  expect(schedule.days_available).toBe(daysAvailable);
  expect(schedule.days).toHaveLength(daysAvailable);
  const validIds = allQuestionIds(questions);
  for (const day of schedule.days) {
    expect(Number.isInteger(day.minutes)).toBe(true);
    expect(day.minutes).toBeGreaterThanOrEqual(0);
    for (const qid of day.question_ids) {
      expect(validIds.has(qid)).toBe(true);
    }
  }
}

function mustIdsAppearSomewhere(
  schedule: ReturnType<typeof allocateSchedule>,
  requirements: Requirement[],
  questions: Question[],
) {
  const mustIds = requirements.filter((r) => r.priority === 'must').map((r) => r.id);
  const scheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));
  const coveredRequirementIds = new Set(
    questions.filter((qq) => scheduledQuestionIds.has(qq.id)).flatMap((qq) => qq.requirement_ids),
  );
  for (const id of mustIds) {
    expect(coveredRequirementIds.has(id)).toBe(true);
  }
}

describe('allocateSchedule', () => {
  const requirements = [req('r1', 'must'), req('r2', 'must'), req('r3', 'nice')];
  const questions = [
    q('q1', ['r1'], 3, 'system-design'),
    q('q2', ['r2'], 3, 'technical'),
    q('q3', ['r3'], 1, 'behavioural'),
    q('q4', ['r1'], 2, 'technical'),
    q('q5', ['r2'], 2, 'company-fit'),
  ];

  it('produces exactly 1 day and puts everything in it', () => {
    const schedule = allocateSchedule(requirements, questions, 1);
    assertBasicInvariants(schedule, 1, questions);
    expect(schedule.days[0]!.question_ids).toHaveLength(5);
    mustIdsAppearSomewhere(schedule, requirements, questions);
  });

  it('produces exactly 2 days', () => {
    const schedule = allocateSchedule(requirements, questions, 2);
    assertBasicInvariants(schedule, 2, questions);
    mustIdsAppearSomewhere(schedule, requirements, questions);
  });

  it('produces exactly 5 days', () => {
    const schedule = allocateSchedule(requirements, questions, 5);
    assertBasicInvariants(schedule, 5, questions);
    mustIdsAppearSomewhere(schedule, requirements, questions);
  });

  it('places the highest-scored (must/hardest) question on day 1', () => {
    const schedule = allocateSchedule(requirements, questions, 5);
    // q1: must + difficulty 3 + system-design => highest possible score
    expect(schedule.days[0]!.question_ids).toContain('q1');
  });

  it('handles more days than questions with deterministic review days', () => {
    const schedule = allocateSchedule(requirements, questions, 30);
    assertBasicInvariants(schedule, 30, questions);
    mustIdsAppearSomewhere(schedule, requirements, questions);
    const emptyDays = schedule.days.filter((d) => d.question_ids.length === 0);
    expect(emptyDays).toHaveLength(0); // filled with review days instead
    const reviewDays = schedule.days.filter((d) => d.focus === 'Review & reinforce');
    expect(reviewDays.length).toBeGreaterThan(0);
  });

  it('handles a 60-day schedule', () => {
    const schedule = allocateSchedule(requirements, questions, 60);
    assertBasicInvariants(schedule, 60, questions);
    mustIdsAppearSomewhere(schedule, requirements, questions);
  });

  it('handles zero questions gracefully', () => {
    const schedule = allocateSchedule(requirements, [], 5);
    assertBasicInvariants(schedule, 5, []);
    for (const day of schedule.days) {
      expect(day.question_ids).toEqual([]);
    }
  });

  it('handles many more questions than days without dropping any must coverage', () => {
    const many: Question[] = [];
    for (let i = 0; i < 40; i++) {
      many.push(q(`m${i}`, i % 2 === 0 ? ['r1'] : ['r2'], ((i % 3) + 1) as 1 | 2 | 3));
    }
    const schedule = allocateSchedule(requirements, many, 3);
    assertBasicInvariants(schedule, 3, many);
    mustIdsAppearSomewhere(schedule, requirements, many);
    const totalScheduled = schedule.days.reduce((sum, d) => sum + d.question_ids.length, 0);
    expect(totalScheduled).toBe(many.length);
  });

  it('excludes deleted questions and deleted requirements from scheduling', () => {
    const withDeleted = questions.map((qq, i) => (i === 0 ? { ...qq, deleted: true } : qq));
    const schedule = allocateSchedule(requirements, withDeleted, 3);
    const scheduledIds = new Set(schedule.days.flatMap((d) => d.question_ids));
    expect(scheduledIds.has('q1')).toBe(false);
  });
});
