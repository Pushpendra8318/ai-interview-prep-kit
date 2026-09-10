'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useGenerationStatus } from '@/lib/hooks';
import { api } from '@/lib/api-client';

const STAGE_LABELS: Record<string, string> = {
  validating_input: 'Validating Input',
  researching_company: 'Researching Company',
  finding_relevant_pages: 'Finding Relevant Pages',
  finding_hiring_process: 'Finding Hiring Process',
  searching_public_discussion: 'Searching Public Discussion',
  extracting_requirements: 'Extracting Requirements',
  generating_company_brief: 'Generating Company Brief',
  generating_role_breakdown: 'Generating Role Breakdown',
  generating_questions: 'Generating Questions',
  generating_flashcards: 'Generating Flashcards',
  checking_coverage: 'Checking Coverage',
  closing_coverage_gaps: 'Closing Coverage Gaps',
  building_schedule: 'Building Schedule',
  validating_kit: 'Validating Kit',
};

export function GenerationProgress({ kitId }: { kitId: string }) {
  const { data: job, isLoading } = useGenerationStatus(kitId, true);
  const qc = useQueryClient();

  async function retry() {
    await api.post(`/api/v1/kits/${kitId}/generate`);
    qc.invalidateQueries({ queryKey: ['generation-status', kitId] });
  }

  if (isLoading || !job) {
    return (
      <div className="card flex flex-col items-center gap-3 py-14 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-slate-500">Starting generation…</p>
      </div>
    );
  }

  const completedCount = job.stages.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const progressPct = Math.round((completedCount / job.stages.length) * 100);

  return (
    <div className="card section-fade">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display font-medium text-slate-900">Generating your kit</h2>
        <span className="text-xs font-medium text-slate-400">{progressPct}%</span>
      </div>
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="space-y-2.5">
        {job.stages.map((stage) => (
          <li key={stage.name} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                stage.status === 'failed'
                  ? 'bg-red-100 text-red-600'
                  : stage.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-600'
                    : stage.status === 'running'
                      ? 'animate-pulse bg-amber-100 text-amber-600'
                      : stage.status === 'skipped'
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-slate-50 text-slate-300'
              }`}
            >
              {stage.status === 'completed'
                ? '✓'
                : stage.status === 'failed'
                  ? '✕'
                  : stage.status === 'skipped'
                    ? '–'
                    : '○'}
            </span>
            <span className={stage.status === 'pending' ? 'text-slate-400' : 'text-slate-700'}>
              {STAGE_LABELS[stage.name] ?? stage.name}
            </span>
            {stage.error && <span className="text-xs text-red-600">({stage.error})</span>}
          </li>
        ))}
      </ol>

      {job.status === 'failed' && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p className="mb-3">Generation failed{job.error ? `: ${job.error.message}` : '.'}</p>
          <button className="btn-secondary" onClick={retry}>
            Retry generation
          </button>
        </div>
      )}
    </div>
  );
}
