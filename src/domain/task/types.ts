export interface Task {
  id: string;
  title: string;
  isDone: boolean;
  /** Dormant for now — no UI links a task to a ritual yet. Kept for future use. */
  ritualId: string | null;
  sortOrder: number;
  createdAt: number;
  completedAt: number | null;
}
