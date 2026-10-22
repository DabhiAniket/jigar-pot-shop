import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAdmin,
  createHarness,
  ORIGIN,
  STRONG_PASSWORD,
  type Harness,
} from '../helpers/harness';

// This file runs with application rate limits switched on (the rest of the suite disables them).
process.env.RATE_LIMITS = 'on';

let harness: Harness;
beforeAll(async () => {
  harness = await createHarness();
});
afterAll(async () => {
  await harness.close();
});

const attempt = (email: string, password: string) =>
  harness
    .request()
    .post('/api/v1/admin/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password });

describe('sign-in rate limiting', () => {
  it('counts only failed attempts per account and blocks after six', async () => {
    const { email } = await createAdmin('order_manager');
    for (let i = 0; i < 3; i++) expect((await attempt(email, STRONG_PASSWORD)).status).toBe(200);
    const failures = [];
    for (let i = 0; i < 7; i++) failures.push((await attempt(email, 'Wrong-Password-99')).status);
    expect(failures.slice(0, 6)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(failures[6]).toBe(429);
    // Once blocked, even the correct password is refused until the window passes.
    const blocked = await attempt(email, STRONG_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['ratelimit-policy'] ?? blocked.headers['ratelimit']).toBeDefined();
  });

  it('limits unknown accounts the same way, so blocking does not reveal which emails exist', async () => {
    const statuses = [];
    for (let i = 0; i < 7; i++)
      statuses.push((await attempt('nobody-here@example.com', 'Wrong-Password-99')).status);
    expect(statuses.at(-1)).toBe(429);
  });
});
