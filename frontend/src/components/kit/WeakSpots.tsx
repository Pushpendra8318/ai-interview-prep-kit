'use client';

import { useWeakSpots } from '@/lib/hooks';

interface WeakSpotsData {
  uncoveredRequirements: { id: string; text: string; priority: string }[];
  weakFlashcards: { id: string; front: string; confidence: string; reviewCount: number }[];
  neverPracticedFlashcards: { id: string; front: string }[];
  recommendedFocusCategory: string | null;
}

export function WeakSpots({ kitId }: { kitId: string }) {
  const { data, isLoading } = useWeakSpots(kitId);
  const weak = data as WeakSpotsData | undefined;

  if (isLoading)
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center text-slate-500">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        Analyzing your progress…
      </div>
    );
  if (!weak) return null;

  const nothingToShow =
    weak.uncoveredRequirements.length === 0 &&
    weak.weakFlashcards.length === 0 &&
    weak.neverPracticedFlashcards.length === 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        A real-time view of what still needs work, built from your coverage check and practice history — not
        a cosmetic summary.
      </p>

      {nothingToShow && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-3xl">🎉</span>
          <p className="text-emerald-700">
            Nothing weak to report yet — either everything is covered and practiced, or you haven&apos;t
            started practicing.
          </p>
        </div>
      )}

      {weak.uncoveredRequirements.length > 0 && (
        <section className="card border-l-4 border-l-rose-400">
          <h2 className="mb-2 flex items-center gap-1.5 font-display font-medium text-rose-700">
            <span aria-hidden>⚠️</span> Uncovered must-have requirements
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {weak.uncoveredRequirements.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </section>
      )}

      {weak.weakFlashcards.length > 0 && (
        <section className="card">
          <h2 className="mb-2 flex items-center gap-1.5 font-display font-medium">
            <span aria-hidden>🧠</span> Least-confident flashcards
          </h2>
          <ul className="divide-y divide-slate-100 text-sm text-slate-700">
            {weak.weakFlashcards.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-1.5">
                <span>{f.front}</span>
                <span className="badge bg-slate-100 text-slate-500">{f.confidence}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {weak.neverPracticedFlashcards.length > 0 && (
        <section className="card">
          <h2 className="mb-2 flex items-center gap-1.5 font-display font-medium">
            <span aria-hidden>👀</span> Never practiced
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {weak.neverPracticedFlashcards.map((f) => (
              <li key={f.id}>{f.front}</li>
            ))}
          </ul>
        </section>
      )}

      {weak.recommendedFocusCategory && (
        <section className="card bg-brand-gradient-soft">
          <h2 className="mb-1 flex items-center gap-1.5 font-display font-medium text-brand-800">
            <span aria-hidden>💡</span> Recommended focus
          </h2>
          <p className="text-sm text-brand-900/80">
            Your question bank is thinnest in <strong>{weak.recommendedFocusCategory}</strong> — consider
            regenerating that category for more practice material.
          </p>
        </section>
      )}
    </div>
  );
}
