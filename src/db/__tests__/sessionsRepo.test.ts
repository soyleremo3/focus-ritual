import { cancel, createSession, finish, pause, reconcile } from '@/domain/timer/timerEngine';

import { getActiveSession, getSessionById, listTerminalSessions, upsertSession } from '../repositories/sessionsRepo';
import { migrate } from '../schema';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('sessionsRepo', () => {
  it('round-trips a session through upsert and getSessionById', async () => {
    const db = createTestDatabase();
    await migrate(db);

    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    await upsertSession(db, session, T0);

    const fetched = await getSessionById(db, 's1');
    expect(fetched).toEqual(session);
  });

  it('updates in place on a second upsert without creating a duplicate row', async () => {
    const db = createTestDatabase();
    await migrate(db);

    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    await upsertSession(db, session, T0);

    const pausedSession = pause(session, T0 + 5 * MIN);
    await upsertSession(db, pausedSession, T0 + 5 * MIN);

    const fetched = await getSessionById(db, 's1');
    expect(fetched).toEqual(pausedSession);

    const all = await db.getAllAsync('SELECT id FROM sessions', []);
    expect(all).toHaveLength(1);
  });

  it('getActiveSession returns null when nothing is active', async () => {
    const db = createTestDatabase();
    await migrate(db);
    expect(await getActiveSession(db)).toBeNull();
  });

  it('getActiveSession finds a running session', async () => {
    const db = createTestDatabase();
    await migrate(db);

    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    await upsertSession(db, session, T0);

    expect(await getActiveSession(db)).toEqual(session);
  });

  it('getActiveSession ignores completed/cancelled sessions and returns the most recently updated active one', async () => {
    const db = createTestDatabase();
    await migrate(db);

    const finished = createSession({ id: 'old', mode: 'pomodoro', now: T0 });
    await upsertSession(db, { ...finished, status: 'completed' }, T0);

    const active = createSession({ id: 'new', mode: 'flow', now: T0 + MIN });
    await upsertSession(db, active, T0 + MIN);

    const result = await getActiveSession(db);
    expect(result?.id).toBe('new');
  });

  it('recovers a running session across a simulated cold start and reconciles it correctly', async () => {
    const db = createTestDatabase();
    await migrate(db);

    // Session was running when the app was killed 30 minutes ago (25min focus + 5min into break).
    const startedSession = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    await upsertSession(db, startedSession, T0);

    // Simulate "cold start": read the active session back and reconcile against `now`,
    // exactly like timerStore's hydrate() does — no special-casing vs. the
    // background/foreground path, same reconcile() function.
    const recovered = await getActiveSession(db);
    expect(recovered).not.toBeNull();

    const now = T0 + 25 * MIN + 5 * MIN + MIN; // 1 minute into what would be awaiting-start
    const reconciled = reconcile(recovered!, now);

    expect(reconciled.status).toBe('awaiting-start');
    expect(reconciled.phase).toBe('break');
    expect(reconciled.cyclesCompleted).toBe(1);
  });

  it('recovers a paused session with elapsed time frozen exactly as it was', async () => {
    const db = createTestDatabase();
    await migrate(db);

    const session = createSession({ id: 's1', mode: 'deepWork', now: T0 });
    const pausedSession = pause(session, T0 + 12 * MIN);
    await upsertSession(db, pausedSession, T0 + 12 * MIN);

    const recovered = await getActiveSession(db);
    const reconciled = reconcile(recovered!, T0 + 999 * MIN); // long after the "app was closed"

    expect(reconciled.status).toBe('paused');
    expect(reconciled.accumulatedMs).toBe(12 * MIN);
  });

  it('round-trips taskId and bankedFocusMs', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await db.runAsync('INSERT INTO tasks (id, title, created_at) VALUES (?, ?, ?)', ['task-1', 'Write report', T0]);

    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0, taskId: 'task-1' });
    const onBreak = reconcile(session, T0 + 25 * MIN + 30_000);
    await upsertSession(db, onBreak, T0 + 25 * MIN + 30_000);

    const fetched = await getSessionById(db, 's1');
    expect(fetched?.taskId).toBe('task-1');
    expect(fetched?.bankedFocusMs).toBe(25 * MIN);
  });

  describe('listTerminalSessions', () => {
    it('excludes running/paused/awaiting-start sessions', async () => {
      const db = createTestDatabase();
      await migrate(db);

      const running = createSession({ id: 'running', mode: 'pomodoro', now: T0 });
      await upsertSession(db, running, T0);
      const paused = pause(createSession({ id: 'paused', mode: 'pomodoro', now: T0 }), T0 + MIN);
      await upsertSession(db, paused, T0 + MIN);

      expect(await listTerminalSessions(db)).toEqual([]);
    });

    it('includes completed and cancelled sessions, newest first', async () => {
      const db = createTestDatabase();
      await migrate(db);

      const older = finish(createSession({ id: 'older', mode: 'deepWork', now: T0 }), T0 + 10 * MIN);
      await upsertSession(db, older, T0 + 10 * MIN);

      const newer = cancel(createSession({ id: 'newer', mode: 'pomodoro', now: T0 + MIN }), T0 + 2 * MIN);
      await upsertSession(db, newer, T0 + 2 * MIN);

      const result = await listTerminalSessions(db);
      expect(result.map((s) => s.id)).toEqual(['newer', 'older']);
      expect(result.map((s) => s.status)).toEqual(['cancelled', 'completed']);
    });

    it('never double-records a session repeatedly upserted across its lifecycle', async () => {
      const db = createTestDatabase();
      await migrate(db);

      const session = createSession({ id: 's1', mode: 'deepWork', now: T0 });
      await upsertSession(db, session, T0); // created (running)
      const paused = pause(session, T0 + 5 * MIN);
      await upsertSession(db, paused, T0 + 5 * MIN); // paused
      const resumed = { ...paused, status: 'running' as const, startedAt: T0 + 10 * MIN };
      await upsertSession(db, resumed, T0 + 10 * MIN); // resumed
      const finished = finish(resumed, T0 + 20 * MIN);
      await upsertSession(db, finished, T0 + 20 * MIN); // finished — 4th upsert, same id throughout

      const result = await listTerminalSessions(db);
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('completed');
    });
  });
});
