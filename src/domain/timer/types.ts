export type TimerMode = 'pomodoro' | 'deepWork' | 'ninety' | 'custom' | 'stopwatch' | 'flow';

export type TimerPhase = 'focus' | 'break';

export type TimerStatus = 'running' | 'paused' | 'awaiting-start' | 'completed' | 'cancelled';

export interface TimerSession {
  id: string;
  ritualId: string | null;
  mode: TimerMode;
  phase: TimerPhase;
  status: TimerStatus;
  /** Epoch ms when the current run segment began; null while not running. */
  startedAt: number | null;
  /** Ms banked from prior run segments of the current phase, before the latest pause/boundary. */
  accumulatedMs: number;
  /** Minutes for a focus phase; null means unbounded (stopwatch). */
  focusMinutes: number | null;
  /** Minutes for a break phase; null means this mode has no break phase. */
  breakMinutes: number | null;
  /** Number of focus cycles this session targets; null means unbounded. */
  cyclesTarget: number | null;
  cyclesCompleted: number;
}

export interface ModeDefaults {
  focusMinutes: number | null;
  breakMinutes: number | null;
  cyclesTarget: number | null;
}

/**
 * Flow's focusMinutes is a soft check-in interval, not a hard cutoff — see autoStarts()
 * in timerEngine.ts, which always halts Flow at that boundary for a "Keep the flow?" decision
 * rather than auto-starting a break.
 */
export const MODE_DEFAULTS: Record<TimerMode, ModeDefaults> = {
  pomodoro: { focusMinutes: 25, breakMinutes: 5, cyclesTarget: 4 },
  deepWork: { focusMinutes: 50, breakMinutes: 10, cyclesTarget: null },
  ninety: { focusMinutes: 90, breakMinutes: 20, cyclesTarget: null },
  custom: { focusMinutes: 25, breakMinutes: 5, cyclesTarget: null },
  stopwatch: { focusMinutes: null, breakMinutes: null, cyclesTarget: null },
  flow: { focusMinutes: 45, breakMinutes: 15, cyclesTarget: null },
};
