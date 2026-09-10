'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { NavBar } from '@/components/NavBar';
import { GenerationProgress } from '@/components/kit/GenerationProgress';
import { OverviewTab } from '@/components/kit/OverviewTab';
import { QuestionsBuilder } from '@/components/kit/QuestionsBuilder';
import { FlashcardsEditor } from '@/components/kit/FlashcardsEditor';
import { ScheduleView } from '@/components/kit/ScheduleView';
import { PracticeMode } from '@/components/kit/PracticeMode';
import { WeakSpots } from '@/components/kit/WeakSpots';
import { useKit } from '@/lib/hooks';

const TABS = [
  { key: 'overview', label: 'Overview', icon: '🏢' },
  { key: 'questions', label: 'Questions', icon: '❓' },
  { key: 'flashcards', label: 'Flashcards', icon: '🗂️' },
  { key: 'schedule', label: 'Schedule', icon: '🗓️' },
  { key: 'practice', label: 'Practice', icon: '🎯' },
  { key: 'weak-spots', label: 'Weak Spots', icon: '📊' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function KitContent() {
  const params = useParams<{ id: string }>();
  const kitId = params.id;
  const { data: kitDoc, isLoading, isError, refetch } = useKit(kitId);
  const [tab, setTab] = useState<TabKey>('overview');

  return (
    <>
      <NavBar />
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        {isLoading && (
          <div className="space-y-3">
            <div className="card h-16 animate-pulse bg-slate-100" />
            <div className="card h-40 animate-pulse bg-slate-100" />
          </div>
        )}

        {isError && (
          <div className="card text-center text-red-600">
            Couldn&apos;t load this kit.{' '}
            <button className="font-medium underline" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}

        {kitDoc &&
          (kitDoc.status === 'draft' ||
            kitDoc.status === 'researching' ||
            kitDoc.status === 'generating') && <GenerationProgress kitId={kitId} />}

        {kitDoc && kitDoc.status === 'failed' && <GenerationProgress kitId={kitId} />}

        {kitDoc && kitDoc.status === 'ready' && (
          <div className="section-fade">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-soft font-display text-base font-semibold text-brand-700">
                  {(kitDoc.kit.source.company || '?').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <h1 className="font-display text-xl font-semibold text-slate-900">
                    {kitDoc.kit.source.company || 'Untitled company'}
                  </h1>
                  <p className="text-sm text-slate-500">{kitDoc.kit.source.role || 'Untitled role'}</p>
                </div>
              </div>
              <span
                className={`badge self-start sm:self-auto ${
                  kitDoc.kit.coverage.uncovered_requirement_ids.length === 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {kitDoc.kit.coverage.uncovered_requirement_ids.length === 0
                  ? '✓ All must-haves covered'
                  : `${kitDoc.kit.coverage.uncovered_requirement_ids.length} must-have(s) uncovered`}
              </span>
            </div>

            <div
              className="section-slide mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
              role="tablist"
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setTab(t.key)}
                >
                  <span aria-hidden>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="section-slide">
              {tab === 'overview' && <OverviewTab kitDoc={kitDoc} />}
              {tab === 'questions' && <QuestionsBuilder kitDoc={kitDoc} />}
              {tab === 'flashcards' && <FlashcardsEditor kitDoc={kitDoc} />}
              {tab === 'schedule' && <ScheduleView kitDoc={kitDoc} />}
              {tab === 'practice' && <PracticeMode kitDoc={kitDoc} />}
              {tab === 'weak-spots' && <WeakSpots kitId={kitDoc._id} />}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function KitPage() {
  return (
    <RequireAuth>
      <KitContent />
    </RequireAuth>
  );
}
