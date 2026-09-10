import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll } from 'vitest';
import { connectDb, disconnectDb } from '@prepkit/db';

process.env.LLM_API_KEY ??= 'test-key';
process.env.SESSION_SECRET ??= 'test-session-secret-not-for-production';
process.env.FRONTEND_URL ??= 'http://localhost:3000';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
}, 60_000);

afterAll(async () => {
  await disconnectDb();
  await mongod.stop();
});
