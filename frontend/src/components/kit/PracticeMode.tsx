'use client';

import { useMemo, useState } from 'react';
import type { KitDocDTO } from '@/lib/types';
import { usePracticeProgress, useRecordPractice } from '@/lib/hooks';

const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

const CONFIDENCE_BUTTONS = [
  { key: 'low' as const, label: 'Low', className: 'border-rose-200 text-rose-700 hover:bg-rose-50' },
  { key: 'medium' as const, label: 'Medium', className: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { key: 'high' as const, label: 'High', className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
];

export function PracticeMode({ kitDoc }: { kitDoc: KitDocDTO }) {
  const kitId = kitDoc._id;
  const { data: progress, isLoading } = usePracticeProgress(kitId);
  const recordPractice = useRecordPractice(kitId);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const flashcards = kitDoc.kit.flashcards.filter((f) => !f.deleted);
  const progressByCard = useMemo(
    () => new Map((progress ?? []).map((p) => [p.flashcardId, p])),
    [progress],
  );

  const ordered = useMemo(
    () =>
      [...flashcards].sort((a, b) => {
        const ra = CONFIDENCE_RANK[progressByCard.get(a.id)?.confidence ?? 'low'] ?? 0;
        const rb = CONFIDENCE_RANK[progressByCard.get(b.id)?.confidence ?? 'low'] ?? 0;
        return ra - rb;
      }),
    [flashcards, progressByCard],
  );

  const coveredCount = flashcards.filter((f) => progressByCard.get(f.id)?.covered).length;

  if (isLoading)
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        Loading practice progress…
      </div>
    );
  if (flashcards.length === 0) return <p className="card text-center text-slate-500">No flashcards to practice yet.</p>;

  const current = ordered[Math.min(index, ordered.length - 1)]!;

  async function onRate(confidence: 'low' | 'medium' | 'high') {
    await recordPractice.mutateAsync({ flashcardId: current.id, confidence });
    setRevealed(false);
    setIndex((i) => (i + 1) % ordered.length);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-sm text-slate-600">
        <span>
          {coveredCount} / {flashcards.length} covered · least-confident first
        </span>
        <span className="text-xs text-slate-400">
          Card {index + 1} of {ordered.length}
        </span>
      </div>
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all duration-500"
          style={{ width: `${(coveredCount / flashcards.length) * 100}%` }}
        />
      </div>

      <div className="card min-h-[220px] bg-brand-gradient-soft">
        <p className="mb-4 font-display text-xl font-medium leading-snug text-slate-900">{current.front}</p>

        {revealed ? (
          <>
            <p className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
              {current.back}
            </p>
            <p className="mb-2 text-sm text-slate-600">How confident did you feel?</p>
            <div className="flex flex-wrap gap-2">
              {CONFIDENCE_BUTTONS.map((b) => (
                <button
                  key={b.key}
                  className={`btn border bg-white ${b.className}`}
                  onClick={() => onRate(b.key)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <button className="btn-primary" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        )}
      </div>

      <div className="mt-3 flex justify-between text-sm">
        <button
          className="btn-secondary"
          onClick={() => {
            setRevealed(false);
            setIndex((i) => (i - 1 + ordered.length) % ordered.length);
          }}
        >
          ← Previous
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            setRevealed(false);
            setIndex((i) => (i + 1) % ordered.length);
          }}
        >
          Skip →
        </button>
      </div>
    </div>
  );
}
