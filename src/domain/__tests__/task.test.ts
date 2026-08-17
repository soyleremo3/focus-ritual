import { isValidTaskTitle, nextSortOrder, sortTasks } from '../task/task';
import type { Task } from '../task/types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    title: 'Task',
    isDone: false,
    ritualId: null,
    sortOrder: 0,
    createdAt: 0,
    completedAt: null,
    mode: null,
    focusMinutes: null,
    ...overrides,
  };
}

describe('isValidTaskTitle', () => {
  test('rejects empty or whitespace-only titles', () => {
    expect(isValidTaskTitle('')).toBe(false);
    expect(isValidTaskTitle('   ')).toBe(false);
  });

  test('accepts a normal title', () => {
    expect(isValidTaskTitle('Write the report')).toBe(true);
  });

  test('rejects titles over 140 characters', () => {
    expect(isValidTaskTitle('a'.repeat(141))).toBe(false);
    expect(isValidTaskTitle('a'.repeat(140))).toBe(true);
  });
});

describe('sortTasks', () => {
  test('incomplete tasks sort before completed ones', () => {
    const done = makeTask({ id: 'done', isDone: true, sortOrder: 0 });
    const pending = makeTask({ id: 'pending', isDone: false, sortOrder: 1 });
    expect(sortTasks([done, pending]).map((t) => t.id)).toEqual(['pending', 'done']);
  });

  test('incomplete tasks order by sortOrder ascending', () => {
    const a = makeTask({ id: 'a', sortOrder: 2 });
    const b = makeTask({ id: 'b', sortOrder: 0 });
    const c = makeTask({ id: 'c', sortOrder: 1 });
    expect(sortTasks([a, b, c]).map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  test('completed tasks order by most-recently-completed first', () => {
    const older = makeTask({ id: 'older', isDone: true, completedAt: 100 });
    const newer = makeTask({ id: 'newer', isDone: true, completedAt: 200 });
    expect(sortTasks([older, newer]).map((t) => t.id)).toEqual(['newer', 'older']);
  });

  test('does not mutate the input array', () => {
    const list = [makeTask({ id: 'a', sortOrder: 1 }), makeTask({ id: 'b', sortOrder: 0 })];
    const copy = [...list];
    sortTasks(list);
    expect(list).toEqual(copy);
  });
});

describe('nextSortOrder', () => {
  test('returns 0 for an empty list', () => {
    expect(nextSortOrder([])).toBe(0);
  });

  test('returns one past the current highest sortOrder', () => {
    const tasks = [makeTask({ sortOrder: 0 }), makeTask({ sortOrder: 3 }), makeTask({ sortOrder: 1 })];
    expect(nextSortOrder(tasks)).toBe(4);
  });
});
