'use client';

import { useState } from 'react';
import type { Kit } from '@prepkit/schema';

type Question = Kit['questions'][number];
type Category = Question['category'];

const CATEGORIES: Category[] = ['technical', 'behavioural', 'system-design', 'company-fit'];

export function QuestionCard({
  question,
  isFirst,
  isLast,
  onSave,
  onDelete,
  onPin,
  onMoveCategory,
  onMoveUp,
  onMoveDown,
}: {
  question: Question;
  isFirst: boolean;
  isLast: boolean;
  onSave: (patch: {
    prompt: string;
    answer_outline: string;
    difficulty: 1 | 2 | 3;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onPin: (isPinned: boolean) => Promise<void>;
  onMoveCategory: (category: Category) => Promise<void>;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [answerOutline, setAnswerOutline] = useState(question.answer_outline);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(question.difficulty as 1 | 2 | 3);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({ prompt, answer_outline: answerOutline, difficulty });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setPrompt(question.prompt);
    setAnswerOutline(question.answer_outline);
    setDifficulty(question.difficulty as 1 | 2 | 3);
    setEditing(false);
  }

  return (
    <li className="card card-hover">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className={`badge ${question.origin === 'user' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
          {question.origin === 'user' ? '✎ User-added' : 'Generated'}
        </span>
        {question.isEdited && <span className="badge bg-blue-100 text-blue-700">Edited</span>}
        {question.isPinned && <span className="badge bg-amber-100 text-amber-700">📌 Pinned</span>}
        <span className="badge bg-slate-100 text-slate-600">
          {'●'.repeat(question.difficulty)}
          {'○'.repeat(3 - question.difficulty)}
        </span>
        {question.requirement_ids.length > 0 && (
          <span className="badge bg-slate-100 text-slate-500">covers {question.requirement_ids.join(', ')}</span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            className="input"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Answer outline"
            value={answerOutline}
            onChange={(e) => setAnswerOutline(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            Difficulty
            <select
              className="input w-20"
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn-secondary" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-800">{question.prompt}</p>
          {question.answer_outline && (
            <p className="mt-1 text-sm text-slate-600">{question.answer_outline}</p>
          )}
        </>
      )}

      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn-secondary" onClick={() => onPin(!question.isPinned)}>
            {question.isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            className="btn-secondary"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
          >
            ↑ Up
          </button>
          <button
            className="btn-secondary"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
          >
            ↓ Down
          </button>
          <label className="flex items-center gap-1">
            Move to
            <select
              className="input w-auto py-1"
              value={question.category}
              onChange={(e) => onMoveCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
