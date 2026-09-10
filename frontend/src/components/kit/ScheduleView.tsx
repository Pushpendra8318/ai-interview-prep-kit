'use client';

import { useState } from 'react';
import type { KitDocDTO } from '@/lib/types';
import { useRegenerateSchedule } from '@/lib/hooks';

export function ScheduleView({ kitDoc }: { kitDoc: KitDocDTO }) {
  const { kit } = kitDoc;
  const regenerate = useRegenerateSchedule(kitDoc._id);
  // Kept as a string - deriving a number straight from onChange snapped an
  // emptied field back to "0" on every keystroke, making it hard to retype.
  const [daysInput, setDaysInput] = useState(String(kit.schedule.days_available));

  const questionsById = new Map(kit.questions.map((q) => [q.id, q]));

  return (
    <div>
      <div className="card mb-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Days available
          <input
            type="number"
            min={1}
            max={60}
            className="input w-24"
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            onBlur={() => {
              const clamped = Math.min(60, Math.max(1, Math.round(Number(daysInput)) || 1));
              setDaysInput(String(clamped));
            }}
          />
        </label>
        <button
          className="btn-primary"
          onClick={() => {
            const clamped = Math.min(60, Math.max(1, Math.round(Number(daysInput)) || 1));
            setDaysInput(String(clamped));
            regenerate.mutateAsync(clamped);
          }}
          disabled={regenerate.isPending}
        >
          {regenerate.isPending ? 'Rebuilding…' : '↻ Regenerate schedule'}
        </button>
      </div>

      <ol className="relative space-y-3 border-l-2 border-brand-100 pl-5">
        {kit.schedule.days.map((day) => (
          <li key={day.day} className="card relative">
            <span className="absolute -left-[27px] top-5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-white shadow-glow">
              {day.day}
            </span>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display font-medium text-slate-900">{day.focus || 'Mixed review'}</h3>
              <span className="badge bg-slate-100 text-slate-500">⏱ {day.minutes} min</span>
            </div>
            {day.question_ids.length === 0 ? (
              <p className="text-sm text-slate-500">No material scheduled for this day yet.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {day.question_ids.map((qid) => {
                  const q = questionsById.get(qid);
                  return <li key={qid}>{q ? q.prompt : `(question ${qid})`}</li>;
                })}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
