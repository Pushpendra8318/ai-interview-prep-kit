'use client';

import { useState } from 'react';
import type { KitDocDTO } from '@/lib/types';
import {
  useAddQuestion,
  useDeleteQuestion,
  useMoveQuestionCategory,
  usePinQuestion,
  useRegenerateCategory,
  useReorderQuestions,
  useUpdateQuestion,
} from '@/lib/hooks';
import { QuestionCard } from './QuestionCard';

const CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  'system-design': 'System Design',
  'company-fit': 'Company Fit',
};

export function QuestionsBuilder({ kitDoc }: { kitDoc: KitDocDTO }) {
  const kitId = kitDoc._id;
  const [category, setCategory] = useState<Category>('technical');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const updateQuestion = useUpdateQuestion(kitId);
  const deleteQuestion = useDeleteQuestion(kitId);
  const pinQuestion = usePinQuestion(kitId);
  const moveCategory = useMoveQuestionCategory(kitId);
  const reorder = useReorderQuestions(kitId);
  const addQuestion = useAddQuestion(kitId);
  const regenerate = useRegenerateCategory(kitId);

  const questionsInCategory = kitDoc.kit.questions
    .filter((q) => q.category === category && !q.deleted)
    .sort((a, b) => a.order - b.order);

  async function moveUp(index: number) {
    if (index === 0) return;
    const ids = questionsInCategory.map((q) => q.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    await reorder.mutateAsync({ category, question_ids: ids });
  }
  async function moveDown(index: number) {
    if (index === questionsInCategory.length - 1) return;
    const ids = questionsInCategory.map((q) => q.id);
    [ids[index + 1], ids[index]] = [ids[index]!, ids[index + 1]!];
    await reorder.mutateAsync({ category, question_ids: ids });
  }

  async function submitNewQuestion(e: React.FormEvent) {
    e.preventDefault();
    await addQuestion.mutateAsync({
      category,
      prompt: newPrompt,
      answer_outline: newAnswer,
      difficulty: 2,
    });
    setNewPrompt('');
    setNewAnswer('');
    setShowAddForm(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                category === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABEL[c]} ({kitDoc.kit.questions.filter((q) => q.category === c && !q.deleted).length})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowAddForm((s) => !s)}>
            {showAddForm ? 'Cancel' : '+ Add question'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => regenerate.mutateAsync(category)}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? 'Regenerating…' : '↻ Regenerate category'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={submitNewQuestion} className="card mb-4 space-y-2">
          <textarea
            required
            className="input"
            rows={2}
            placeholder="Question prompt"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Answer outline (optional)"
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={addQuestion.isPending}>
            {addQuestion.isPending ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}

      {questionsInCategory.length === 0 ? (
        <p className="card text-center text-slate-500">
          No {CATEGORY_LABEL[category].toLowerCase()} questions yet. Add one, or regenerate this
          category.
        </p>
      ) : (
        <ul className="space-y-3">
          {questionsInCategory.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              isFirst={i === 0}
              isLast={i === questionsInCategory.length - 1}
              onSave={(patch) =>
                updateQuestion.mutateAsync({ questionId: q.id, patch }).then(() => undefined)
              }
              onDelete={() => deleteQuestion.mutateAsync(q.id).then(() => undefined)}
              onPin={(isPinned) =>
                pinQuestion.mutateAsync({ questionId: q.id, isPinned }).then(() => undefined)
              }
              onMoveCategory={(cat) =>
                moveCategory.mutateAsync({ questionId: q.id, category: cat }).then(() => undefined)
              }
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
