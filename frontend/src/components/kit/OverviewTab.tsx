'use client';

import { useState } from 'react';
import type { KitDocDTO } from '@/lib/types';
import { useRegenerateBrief } from '@/lib/hooks';

const PRIORITY_COLOR: Record<string, string> = {
  must: 'bg-rose-100 text-rose-700',
  nice: 'bg-slate-100 text-slate-600',
};

export function OverviewTab({ kitDoc }: { kitDoc: KitDocDTO }) {
  const { kit } = kitDoc;
  const regenerateBrief = useRegenerateBrief(kitDoc._id);
  const [confirming, setConfirming] = useState(false);

  async function onRegenerate() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    await regenerateBrief.mutateAsync();
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display font-medium">
            <span aria-hidden>🏢</span> Company brief
          </h2>
          <button
            className="btn-secondary text-xs"
            onClick={onRegenerate}
            disabled={regenerateBrief.isPending}
          >
            {regenerateBrief.isPending
              ? 'Regenerating…'
              : confirming
                ? 'Click again to confirm'
                : 'Regenerate'}
          </button>
        </div>
        <p className="text-sm text-slate-700">
          {kit.company_brief.summary || 'No summary available yet.'}
        </p>
        {kit.company_brief.what_they_do && (
          <p className="mt-2 text-sm text-slate-600">{kit.company_brief.what_they_do}</p>
        )}
        {kit.company_brief.sources.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {kit.company_brief.sources.map((s) => (
              <li key={s} className="truncate">
                <a href={s} target="_blank" rel="noreferrer" className="hover:underline">
                  {s}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 flex items-center gap-1.5 font-display font-medium">
          <span aria-hidden>👤</span> {kit.role.title || 'Unknown'}{' '}
          <span className="text-sm font-normal text-slate-500">({kit.role.seniority || 'n/a'})</span>
        </h2>
        {kit.role.responsibilities.length > 0 && (
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {kit.role.responsibilities.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        <h3 className="mb-2 text-sm font-medium text-slate-700">Requirements</h3>
        {kit.role.requirements.filter((r) => !r.deleted).length === 0 ? (
          <p className="text-sm text-slate-500">
            No explicit requirements were found in this job description - it may be too thin to
            extract from.
          </p>
        ) : (
          <ul className="space-y-2">
            {kit.role.requirements
              .filter((r) => !r.deleted)
              .map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <span className={`badge ${PRIORITY_COLOR[r.priority]}`}>{r.priority}</span>
                  <span className="badge bg-slate-100 text-slate-600">{r.kind}</span>
                  <span className="text-slate-700">{r.text}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {kit.source.pages_used.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-medium">Sources used</h2>
          <ul className="space-y-1 text-xs text-slate-500">
            {kit.source.pages_used.map((p) => (
              <li key={p} className="truncate">
                <a href={p} target="_blank" rel="noreferrer" className="hover:underline">
                  {p}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
