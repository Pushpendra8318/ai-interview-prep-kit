import { describe, expect, it } from 'vitest';
import { KitSchema, validateKitInvariants, type Kit } from './kit.js';

function baseKit(): Kit {
  return {
    source: {
      company: 'Acme',
      company_url: 'https://acme.example',
      role: 'Backend Engineer',
      location: 'Remote',
      jd_chars: 100,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: { summary: 'Acme builds widgets.', what_they_do: 'Widgets.', sources: [] },
    role: {
      title: 'Backend Engineer',
      seniority: 'Senior',
      responsibilities: ['Build APIs'],
      requirements: [
        {
          id: 'r1',
          text: '5+ years Node.js',
          kind: 'technical',
          priority: 'must',
          origin: 'generated',
          deleted: false,
        },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Explain the event loop.',
        answer_outline: 'Cover phases, microtasks.',
        difficulty: 2,
        origin: 'generated',
        isEdited: false,
        isPinned: false,
        deleted: false,
        version: 1,
        order: 0,
      },
    ],
    flashcards: [],
    schedule: {
      days_available: 1,
      days: [{ day: 1, focus: 'Technical deep-dive', question_ids: ['q1'], minutes: 25 }],
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe('KitSchema', () => {
  it('accepts a well-formed kit', () => {
    const result = KitSchema.safeParse(baseKit());
    expect(result.success).toBe(true);
  });

  it('rejects an invalid priority value', () => {
    const kit = baseKit();
    // @ts-expect-error intentionally invalid for the test
    kit.role.requirements[0].priority = 'important';
    expect(KitSchema.safeParse(kit).success).toBe(false);
  });

  it('rejects float minutes', () => {
    const kit = baseKit();
    // @ts-expect-error intentionally invalid for the test
    kit.schedule.days[0].minutes = 25.5;
    expect(KitSchema.safeParse(kit).success).toBe(false);
  });
});

describe('validateKitInvariants', () => {
  it('passes for a consistent kit', () => {
    expect(validateKitInvariants(baseKit())).toEqual([]);
  });

  it('flags a question referencing an unknown requirement', () => {
    const kit = baseKit();
    kit.questions[0]!.requirement_ids = ['r999'];
    const problems = validateKitInvariants(kit);
    expect(problems.some((p) => p.includes('r999'))).toBe(true);
  });

  it('flags a schedule day count mismatch', () => {
    const kit = baseKit();
    kit.schedule.days_available = 2;
    const problems = validateKitInvariants(kit);
    expect(problems.some((p) => p.includes('schedule has'))).toBe(true);
  });

  it('flags a schedule referencing an unknown question', () => {
    const kit = baseKit();
    kit.schedule.days[0]!.question_ids = ['q999'];
    const problems = validateKitInvariants(kit);
    expect(problems.some((p) => p.includes('q999'))).toBe(true);
  });

  it('flags an uncovered must-have requirement', () => {
    const kit = baseKit();
    kit.coverage.uncovered_requirement_ids = ['r1'];
    const problems = validateKitInvariants(kit);
    expect(problems.some((p) => p.includes('r1'))).toBe(true);
  });
});
