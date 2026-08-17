import type { TimerMode } from '@/domain/timer/types';

export interface Task {
  id: string;
  title: string;
  isDone: boolean;
  /** Dormant for now — no UI links a task to a ritual yet. Kept for future use. */
  ritualId: string | null;
  sortOrder: number;
  createdAt: number;
  completedAt: number | null;
  /** Null = starting this task uses whatever mode/duration is currently selected on the
   * Focus screen (the pre-existing behavior) — set together, never independently. */
  mode: TimerMode | null;
  focusMinutes: number | null;
}
