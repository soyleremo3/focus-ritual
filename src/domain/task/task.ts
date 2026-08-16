import type { Task } from './types';

const MAX_TITLE_LENGTH = 140;

export function isValidTaskTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_TITLE_LENGTH;
}

/**
 * Incomplete tasks first, ordered by sortOrder (the order they were added — no manual
 * reordering in this simple version); completed tasks after, most-recently-completed first.
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (!a.isDone) return a.sortOrder - b.sortOrder;
    return (b.completedAt ?? 0) - (a.completedAt ?? 0);
  });
}

/** Appends after every existing task, regardless of done state — a stable "add to the end." */
export function nextSortOrder(tasks: Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;
}
