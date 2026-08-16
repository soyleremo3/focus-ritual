import { createSession } from '@/domain/timer/timerEngine';

import { getSessionById, upsertSession } from '../repositories/sessionsRepo';
import { createTask, deleteTask, listTasks, toggleTaskDone, updateTaskTitle } from '../repositories/tasksRepo';
import { migrate } from '../schema';
import type { Database } from '../types';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;

async function setupDb(): Promise<Database> {
  const db = createTestDatabase();
  await migrate(db);
  return db;
}

describe('tasksRepo', () => {
  test('createTask inserts an incomplete task with an incrementing sort order', async () => {
    const db = await setupDb();
    const a = await createTask(db, 'Write report', T0);
    const b = await createTask(db, 'Reply to emails', T0 + 1000);

    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    expect(a.isDone).toBe(false);
    expect(a.completedAt).toBeNull();
  });

  test('listTasks returns every created task', async () => {
    const db = await setupDb();
    await createTask(db, 'Write report', T0);
    await createTask(db, 'Reply to emails', T0);

    const tasks = await listTasks(db);
    expect(tasks.map((t) => t.title).sort()).toEqual(['Reply to emails', 'Write report']);
  });

  test('updateTaskTitle renames in place', async () => {
    const db = await setupDb();
    const task = await createTask(db, 'Write report', T0);
    await updateTaskTitle(db, task.id, 'Write the quarterly report');

    const tasks = await listTasks(db);
    expect(tasks[0]?.title).toBe('Write the quarterly report');
  });

  test('toggleTaskDone marks complete with a timestamp, and can be undone', async () => {
    const db = await setupDb();
    const task = await createTask(db, 'Write report', T0);

    await toggleTaskDone(db, task.id, true, T0 + 5000);
    let tasks = await listTasks(db);
    expect(tasks[0]?.isDone).toBe(true);
    expect(tasks[0]?.completedAt).toBe(T0 + 5000);

    await toggleTaskDone(db, task.id, false);
    tasks = await listTasks(db);
    expect(tasks[0]?.isDone).toBe(false);
    expect(tasks[0]?.completedAt).toBeNull();
  });

  test('deleteTask removes the row', async () => {
    const db = await setupDb();
    const task = await createTask(db, 'Write report', T0);
    await deleteTask(db, task.id);

    expect(await listTasks(db)).toEqual([]);
  });

  test('deleting a task safely clears task_id on any session that referenced it, keeping the session', async () => {
    const db = await setupDb();
    const task = await createTask(db, 'Write report', T0);

    const session = createSession({ id: 's1', mode: 'deepWork', now: T0, taskId: task.id });
    await upsertSession(db, session, T0);

    await deleteTask(db, task.id);

    const stillThere = await getSessionById(db, 's1');
    expect(stillThere).not.toBeNull();
    expect(stillThere?.taskId).toBeNull();
  });
});
