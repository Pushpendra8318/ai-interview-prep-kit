import './setup.js';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getEnv } from '../context.js';

const app = createApp(getEnv());

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('auth', () => {
  it('registers, logs in, reads /me, and logs out', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail('register');

    const registerRes = await agent
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email, password: 'password123' });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.data.email).toBe(email);

    const meRes = await agent.get('/api/v1/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe(email);

    const logoutRes = await agent.post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await agent.get('/api/v1/auth/me');
    expect(meAfterLogout.status).toBe(401);
  });

  it('rejects a signed-out visitor from a protected endpoint', async () => {
    const res = await request(app).get('/api/v1/kits');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects duplicate registration and wrong password on login', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail('dup');
    await agent.post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'password123' });

    const dup = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email, password: 'password123' });
    expect(dup.status).toBe(409);

    const badLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrongpassword' });
    expect(badLogin.status).toBe(401);
  });
});

describe('kit ownership', () => {
  async function registeredAgent(prefix: string) {
    const agent = request.agent(app);
    const email = uniqueEmail(prefix);
    await agent.post('/api/v1/auth/register').send({ name: 'Test User', email, password: 'password123' });
    return agent;
  }

  it('lets a user see only their own kits', async () => {
    const alice = await registeredAgent('alice');
    const bob = await registeredAgent('bob');

    const created = await alice.post('/api/v1/kits').send({
      jd: 'We need a senior backend engineer with 5+ years of Node.js experience.',
      company_url: 'https://example.com',
      days: 5,
    });
    expect(created.status).toBe(201);
    const kitId = created.body.data.kitId;

    const aliceGet = await alice.get(`/api/v1/kits/${kitId}`);
    expect(aliceGet.status).toBe(200);

    const bobGet = await bob.get(`/api/v1/kits/${kitId}`);
    expect(bobGet.status).toBe(404);
  });

  it('short-circuits a duplicate jd+company submission for the same user', async () => {
    const alice = await registeredAgent('dupkit');
    const input = {
      jd: 'Two line stub job description.',
      company_url: 'https://another-example.com',
      days: 3,
    };
    const first = await alice.post('/api/v1/kits').send(input);
    expect(first.status).toBe(201);

    const second = await alice.post('/api/v1/kits').send(input);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.kitId).toBe(first.body.data.kitId);
  });
});
