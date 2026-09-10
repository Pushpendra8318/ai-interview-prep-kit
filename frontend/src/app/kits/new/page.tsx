'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { NavBar } from '@/components/NavBar';
import { api, ApiClientError } from '@/lib/api-client';
import { useCreateKit } from '@/lib/hooks';

interface BatchCaseInput {
  jd: string;
  company_url: string;
  days: number;
}

function NewKitContent() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [jd, setJd] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  // Kept as a string so the field can be freely cleared/retyped - deriving a
  // number straight from onChange snapped an emptied field back to "0" on
  // every keystroke, making it effectively impossible to type a new value.
  const [daysInput, setDaysInput] = useState('5');
  const [error, setError] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const createKit = useCreateKit();
  const router = useRouter();

  async function onSubmitSingle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const days = Math.min(60, Math.max(1, Math.round(Number(daysInput)) || 1));
    try {
      const result = await createKit.mutateAsync({ jd, company_url: companyUrl, days });
      router.push(`/kits/${result.kitId}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create the kit. Please try again.');
    }
  }

  async function onBatchFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setBatchSummary(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BatchCaseInput[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('File must contain a JSON array of {jd, company_url, days}');
      }
      const data = await api.post<{ results: { kitId: string }[] }>('/api/v1/kits/batch', { cases: parsed });
      setBatchSummary(`Created ${data.results.length} kit(s). Find them on your dashboard.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that file.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <>
      <NavBar />
      <main id="main" className="mx-auto max-w-2xl px-4 py-10">
        <div className="section-fade mb-8">
          <p className="text-sm font-medium uppercase tracking-wide text-brand-600">New kit</p>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Paste a job description, get a prep plan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            We&apos;ll research the company, extract the real requirements, and build questions,
            flashcards, and a schedule around them.
          </p>
        </div>

        <div className="section-slide mb-5 inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'single'}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setMode('single')}
          >
            Single role
          </button>
          <button
            role="tab"
            aria-selected={mode === 'batch'}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'batch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setMode('batch')}
          >
            Batch upload
          </button>
        </div>

        {error && (
          <p role="alert" className="section-slide mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {mode === 'single' ? (
          <form onSubmit={onSubmitSingle} className="card section-slide space-y-5">
            <div>
              <label htmlFor="jd" className="label">
                Job description
              </label>
              <textarea
                id="jd"
                required
                rows={10}
                className="input font-mono text-[13px] leading-relaxed"
                placeholder="Paste the full job description here…"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="company_url" className="label">
                Company website
              </label>
              <input
                id="company_url"
                type="url"
                required
                className="input"
                placeholder="https://company.example"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="days" className="label">
                Days until interview
              </label>
              <input
                id="days"
                type="number"
                min={1}
                max={60}
                required
                className="input w-28"
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                onBlur={() => {
                  const clamped = Math.min(60, Math.max(1, Math.round(Number(daysInput)) || 1));
                  setDaysInput(String(clamped));
                }}
              />
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={createKit.isPending}>
              {createKit.isPending ? 'Creating…' : 'Create kit'}
            </button>
          </form>
        ) : (
          <div className="card section-slide space-y-4">
            <p className="text-sm text-slate-600">
              Upload a JSON file containing an array of{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{'{ jd, company_url, days }'}</code>{' '}
              objects to create several kits at once.
            </p>
            {batchSummary && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{batchSummary}</p>
            )}
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30">
              <span className="text-2xl">📄</span>
              <span className="text-sm font-medium text-slate-700">Click to choose a JSON file</span>
              <input
                type="file"
                accept="application/json"
                onChange={onBatchFile}
                aria-label="Upload batch JSON file"
                className="sr-only"
              />
            </label>
          </div>
        )}
      </main>
    </>
  );
}

export default function NewKitPage() {
  return (
    <RequireAuth>
      <NewKitContent />
    </RequireAuth>
  );
}
