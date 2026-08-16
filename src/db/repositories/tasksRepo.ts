import { generateId } from '@/domain/id';
import { nextSortOrder } from '@/domain/task/task';
import type { Task } from '@/domain/task/types';

import type { Database } from '../types';

interface TaskRow {
  id: string;
  title: string;
  is_done: number;
  ritual_id: string | null;
  sort_order: number;
  created_at: number;
  completed_at: number | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    isDone: row.is_done === 1,
    ritualId: row.ritual_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listTasks(db: Database): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks', []);
  return rows.map(rowToTask);
}

export async function getTaskById(db: Database, id: string): Promise<Task | null> {
  const row = await db.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  return row ? rowToTask(row) : null;
}

export async function createTask(db: Database, title: string, now: number = Date.now()): Promise<Task> {
  const id = generateId();
  const sortOrder = nextSortOrder(await listTasks(db));
  await db.runAsync(
    `INSERT INTO tasks (id, title, is_done, sort_order, created_at) VALUES (?, ?, 0, ?, ?)`,
    [id, title, sortOrder, now]
  );
  return {
    id,
    title,
    isDone: false,
    ritualId: null,
    sortOrder,
    createdAt: now,
    completedAt: null,
  };
}

export async function updateTaskTitle(db: Database, id: string, title: string): Promise<void> {
  await db.runAsync('UPDATE tasks SET title = ? WHERE id = ?', [title, id]);
}

export async function toggleTaskDone(db: Database, id: string, isDone: boolean, now: number = Date.now()): Promise<void> {
  await db.runAsync('UPDATE tasks SET is_done = ?, completed_at = ? WHERE id = ?', [
    isDone ? 1 : 0,
    isDone ? now : null,
    id,
  ]);
}

/**
 * Hard delete — unlike Rituals/Spaces, a task isn't a historical record anything else
 * needs to keep resolving, and sessions.task_id is ON DELETE SET NULL, so any session
 * that referenced this task safely keeps its own history with the link just cleared.
 */
export async function deleteTask(db: Database, id: string): Promise<void> {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}
