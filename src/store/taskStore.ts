import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import * as tasksRepo from '@/db/repositories/tasksRepo';
import { sortTasks } from '@/domain/task/task';
import type { Task } from '@/domain/task/types';
import type { TimerMode } from '@/domain/timer/types';

interface TaskStoreState {
  tasks: Task[];
  /** True once the first refresh() has resolved — lets screens distinguish "loading" from "genuinely empty". */
  loaded: boolean;
  /** Set when refresh() fails (e.g. a DB read error) — lets the screen show a retry state instead of a blank list. */
  error: string | null;
  refresh: () => Promise<void>;
  create: (title: string) => Promise<Task>;
  updateTitle: (id: string, title: string) => Promise<void>;
  updateDuration: (id: string, mode: TimerMode | null, focusMinutes: number | null) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Wraps tasksRepo and keeps a sortTasks-ordered in-memory cache — every mutation refreshes it. */
export const useTaskStore = create<TaskStoreState>()((set, get) => ({
  tasks: [],
  loaded: false,
  error: null,

  refresh: async () => {
    try {
      const db = await getDatabase();
      const tasks = await tasksRepo.listTasks(db);
      set({ tasks: sortTasks(tasks), loaded: true, error: null });
    } catch (error) {
      console.error('[taskStore] failed to refresh', error);
      set({ loaded: true, error: 'Could not load tasks.' });
    }
  },

  create: async (title) => {
    const db = await getDatabase();
    const created = await tasksRepo.createTask(db, title);
    await get().refresh();
    return created;
  },

  updateTitle: async (id, title) => {
    const db = await getDatabase();
    await tasksRepo.updateTaskTitle(db, id, title);
    await get().refresh();
  },

  updateDuration: async (id, mode, focusMinutes) => {
    const db = await getDatabase();
    await tasksRepo.updateTaskDuration(db, id, mode, focusMinutes);
    await get().refresh();
  },

  toggleDone: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const db = await getDatabase();
    await tasksRepo.toggleTaskDone(db, id, !task.isDone);
    await get().refresh();
  },

  remove: async (id) => {
    const db = await getDatabase();
    await tasksRepo.deleteTask(db, id);
    await get().refresh();
  },
}));
