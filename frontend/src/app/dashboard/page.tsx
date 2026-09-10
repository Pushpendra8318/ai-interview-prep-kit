'use client';

import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { NavBar } from '@/components/NavBar';
import { useKits } from '@/lib/hooks';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  researching: 'Researching…',
  generating: 'Generating…',
  ready: 'Ready',
  failed: 'Failed',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  researching: 'bg-amber-100 text-amber-700',
  generating: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

const STAT_CARDS = [
  { key: 'totalKits', label: 'Total kits', icon: '📚', accent: 'from-brand-500 to-brand-600' },
  { key: 'ready', label: 'Ready', icon: '✅', accent: 'from-emerald-500 to-emerald-600' },
  { key: 'inProgress', label: 'In progress', icon: '⏳', accent: 'from-amber-500 to-amber-600' },
  { key: 'needsAttention', label: 'Need attention', icon: '⚠️', accent: 'from-rose-500 to-rose-600' },
] as const;

function DashboardContent() {
  const { data, isLoading, isError, refetch } = useKits();

  const statValues: Record<(typeof STAT_CARDS)[number]['key'], number> = {
    totalKits: data?.stats?.totalKits ?? 0,
    ready: data?.stats?.byStatus.ready ?? 0,
    inProgress: (data?.stats?.byStatus.researching ?? 0) + (data?.stats?.byStatus.generating ?? 0),
    needsAttention: data?.stats?.needsAttention ?? 0,
  };

  return (
    <>
      <NavBar />
      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <div className="section-fade mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-brand-600">Dashboard</p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Your interview kits</h1>
          </div>
          <Link href="/kits/new" className="btn-primary self-start px-4 py-2.5 sm:self-auto">
            + Create new kit
          </Link>
        </div>

        {data?.stats && (
          <div className="section-slide mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAT_CARDS.map((s) => (
              <div key={s.key} className="card">
                <div
                  className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-sm ${s.accent}`}
                >
                  <span className="grayscale-0">{s.icon}</span>
                </div>
                <p className="font-display text-2xl font-semibold text-slate-900">{statValues[s.key]}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-20 animate-pulse bg-slate-100" />
            ))}
          </div>
        )}

        {isError && (
          <div className="card text-center text-red-600">
            Couldn&apos;t load your kits.{' '}
            <button className="font-medium underline" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <div className="card section-slide flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-2xl">
              🎯
            </span>
            <p className="text-slate-600">You haven&apos;t created a kit yet.</p>
            <Link href="/kits/new" className="btn-primary px-4 py-2.5">
              Create your first kit
            </Link>
          </div>
        )}

        <ul className="section-slide space-y-3">
          {data?.items.map((item) => (
            <li key={item._id}>
              <Link
                href={`/kits/${item._id}`}
                className="card card-hover group flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft font-display text-sm font-semibold text-brand-700">
                    {(item.kit.source?.company || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-brand-700">
                      {item.kit.source?.company || 'Untitled company'}
                    </p>
                    <p className="text-sm text-slate-500">{item.kit.source?.role || 'Untitled role'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span>{item.questionCount} questions</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{item.flashcardCount} flashcards</span>
                  <span className={`badge ${STATUS_COLOR[item.status] ?? ''}`}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
