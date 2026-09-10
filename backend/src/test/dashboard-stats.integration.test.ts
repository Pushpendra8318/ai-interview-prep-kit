import './setup.js';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { KitModel } from '@prepkit/db';
import { createApp } from '../app.js';
import { getEnv } from '../context.js';

const app = createApp(getEnv());

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

/** A minimal-but-valid stub kit, just enough for the dashboard aggregation to project. */
function stubKit(overrides: { uncovered?: string[] } = {}) {
  return {
    source: { company: 'Acme', company_url: 'https://acme.example', role: 'Engineer', location: '', jd_chars: 10, researched_at: '', pages_used: [] },
    company_brief: { summary: '', what_they_do: '', sources: [] },
    role: { title: 'Engineer', seniority: '', responsibilities: [], requirements: [] },
    questions: [{ id: 'q1', requirement_ids: [], category: 'technical', prompt: 'p', answer_outline: '', difficulty: 2 }],
    flashcards: [{ id: 'f1', front: 'f', back: 'b', requirement_ids: [] }],
    schedule: { days_available: 1, days: [{ day: 1, focus: '', question_ids: ['q1'], minutes: 25 }] },
    coverage: { uncovered_requirement_ids: overrides.uncovered ?? [], passes: 1 },
  };
}

async function insertKit(userId: string, status: string, uncovered?: string[]) {
  await KitModel.create({
    userId,
    fingerprint: `fp-${Math.random()}`,
    status,
    jd: 'stub jd',
    days: 5,
    kit: stubKit({ uncovered }),
  });
}

describe('dashboard stats', () => {
  it('counts total/by-status/needs-attention correctly, scoped to the current user only', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail('dash');
    const registerRes = await agent.post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'password123' });
    const userId = registerRes.body.data.id;

    // A second user's kits must never leak into the first user's stats.
    const other = request.agent(app);
    await other.post('/api/v1/auth/register').send({ name: 'Test User', email: uniqueEmail('other'), password: 'password123' });
    const otherRes = await other.post('/api/v1/auth/register').send({ name: 'Test User', email: uniqueEmail('other2'), password: 'password123' });
    await insertKit(otherRes.body.data.id, 'ready', ['rX']);

    // This user's kits: one fully-covered ready kit, one ready-but-needs-attention kit,
    // one researching, one generating, one failed.
    await insertKit(userId, 'ready'); // fully covered
    await insertKit(userId, 'ready', ['r2']); // needs attention
    await insertKit(userId, 'researching');
    await insertKit(userId, 'generating');
    await insertKit(userId, 'failed');

    const res = await agent.get('/api/v1/kits?page=1&limit=20');
    expect(res.status).toBe(200);

    const { stats, items, total } = res.body.data;
    expect(total).toBe(5);
    expect(stats.totalKits).toBe(5);
    expect(stats.byStatus).toMatchObject({ ready: 2, researching: 1, generating: 1, failed: 1 });
    // "In progress" on the dashboard = researching + generating.
    expect((stats.byStatus.researching ?? 0) + (stats.byStatus.generating ?? 0)).toBe(2);
    // "Need attention" = ready kits with a non-empty uncovered_requirement_ids.
    expect(stats.needsAttention).toBe(1);

    expect(items).toHaveLength(5);
    expect(items.every((i: { questionCount: number; flashcardCount: number }) => i.questionCount === 1 && i.flashcardCount === 1)).toBe(true);
  });

  it('reports needsAttention: 0 once every requirement is covered', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send({ name: 'Test User', email: uniqueEmail('covered'), password: 'password123' });
    const me = await agent.get('/api/v1/auth/me');
    await insertKit(me.body.data.id, 'ready'); // uncovered: []

    const res = await agent.get('/api/v1/kits');
    expect(res.body.data.stats.needsAttention).toBe(0);
  });
});
