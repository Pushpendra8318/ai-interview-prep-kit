import { describe, expect, it } from 'vitest';
import type { Kit } from '@prepkit/schema';
import * as m from './kit-mutations.js';

function baseKit(): Kit {
  return {
    source: {
      company: 'Acme',
      company_url: 'https://acme.example',
      role: 'Backend Engineer',
      location: '',
      jd_chars: 100,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: { summary: 'Acme builds widgets.', what_they_do: '', sources: [] },
    role: {
      title: 'Backend Engineer',
      seniority: 'Senior',
      responsibilities: [],
      requirements: [
        {
          id: 'r1',
          text: '5+ years Node.js',
          kind: 'technical',
          priority: 'must',
          origin: 'generated',
          deleted: false,
        },
        {
          id: 'r2',
          text: 'Mentors juniors',
          kind: 'behavioural',
          priority: 'nice',
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
        prompt: 'Explain event loop',
        answer_outline: '',
        difficulty: 2,
        origin: 'generated',
        isEdited: false,
        isPinned: false,
        deleted: false,
        version: 1,
        order: 0,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'behavioural',
        prompt: 'Tell me about mentoring',
        answer_outline: '',
        difficulty: 1,
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
      days: [{ day: 1, focus: '', question_ids: ['q1', 'q2'], minutes: 40 }],
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe('addQuestion', () => {
  it('adds a user-origin question and recomputes coverage', () => {
    const kit = baseKit();
    const updated = m.addQuestion(
      kit,
      { category: 'technical', prompt: 'New Q', difficulty: 2 },
      () => 'q3',
    );
    expect(updated.questions).toHaveLength(3);
    expect(updated.questions[2]).toMatchObject({ id: 'q3', origin: 'user', isEdited: false });
  });
});

describe('updateQuestion', () => {
  it('marks a generated question as edited and bumps version', () => {
    const kit = baseKit();
    const updated = m.updateQuestion(kit, 'q1', { prompt: 'Changed prompt' });
    const q1 = updated.questions.find((q) => q.id === 'q1')!;
    expect(q1.prompt).toBe('Changed prompt');
    expect(q1.isEdited).toBe(true);
    expect(q1.version).toBe(2);
  });

  it('drops requirement ids that do not exist on the kit', () => {
    const kit = baseKit();
    const updated = m.updateQuestion(kit, 'q1', { requirement_ids: ['r1', 'rGhost'] });
    expect(updated.questions.find((q) => q.id === 'q1')!.requirement_ids).toEqual(['r1']);
  });
});

describe('deleteQuestion', () => {
  it('soft-deletes a question and prunes it from the schedule', () => {
    const kit = baseKit();
    const updated = m.deleteQuestion(kit, 'q1');
    expect(updated.questions.find((q) => q.id === 'q1')!.deleted).toBe(true);
    expect(updated.schedule.days[0]!.question_ids).toEqual(['q2']);
  });

  it('recomputes coverage so a deleted must-covering question reopens the gap', () => {
    const kit = baseKit();
    const updated = m.deleteQuestion(kit, 'q1');
    expect(updated.coverage.uncovered_requirement_ids).toContain('r1');
  });
});

describe('partitionCategoryForRegeneration + applyRegeneratedCategory', () => {
  it('preserves user-created, edited, and pinned questions through a category regeneration', () => {
    let kit = baseKit();
    kit = m.addQuestion(
      kit,
      { category: 'technical', prompt: 'Hand-written', difficulty: 1 },
      () => 'q_user',
    );
    kit = m.updateQuestion(kit, 'q1', { prompt: 'Edited by user' }); // now isEdited=true

    const { preserve, otherCategories } = m.partitionCategoryForRegeneration(kit, 'technical');
    expect(preserve.map((q) => q.id).sort()).toEqual(['q1', 'q_user']);
    expect(otherCategories.map((q) => q.id)).toEqual(['q2']);

    const fresh = [
      {
        id: 'q_fresh',
        requirement_ids: ['r1'],
        category: 'technical' as const,
        prompt: 'Freshly generated',
        answer_outline: '',
        difficulty: 2 as const,
        origin: 'generated' as const,
        isEdited: false,
        isPinned: false,
        deleted: false,
        version: 1,
        order: 0,
      },
    ];
    const result = m.applyRegeneratedCategory(kit, 'technical', preserve, otherCategories, fresh);
    const ids = result.questions.map((q) => q.id).sort();
    expect(ids).toEqual(['q1', 'q2', 'q_fresh', 'q_user']);
    // the pre-existing edited/user questions must still be present with their state intact
    expect(result.questions.find((q) => q.id === 'q1')!.isEdited).toBe(true);
  });
});

describe('reorderQuestions', () => {
  it('rewrites order within a category without touching other categories', () => {
    let kit = baseKit();
    kit = m.addQuestion(
      kit,
      { category: 'technical', prompt: 'Second technical', difficulty: 1 },
      () => 'q3',
    );
    const reordered = m.reorderQuestions(kit, 'technical', ['q3', 'q1']);
    const q1 = reordered.questions.find((q) => q.id === 'q1')!;
    const q3 = reordered.questions.find((q) => q.id === 'q3')!;
    expect(q3.order).toBe(0);
    expect(q1.order).toBe(1);
  });
});

describe('flashcards', () => {
  it('adds, edits (marking isEdited), and soft-deletes a flashcard', () => {
    let kit = baseKit();
    kit = m.addFlashcard(kit, { front: 'Q', back: 'A', requirement_ids: ['r1'] }, () => 'f1');
    expect(kit.flashcards).toHaveLength(1);

    kit = m.updateFlashcard(kit, 'f1', { back: 'Better answer' });
    expect(kit.flashcards[0]!.back).toBe('Better answer');
    expect(kit.flashcards[0]!.isEdited).toBe(false); // origin is 'user', not 'generated'

    kit = m.deleteFlashcard(kit, 'f1');
    expect(kit.flashcards[0]!.deleted).toBe(true);
  });
});
