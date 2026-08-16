import type { TimerMode } from '../timer/types';

export interface RitualSoundLayer {
  soundId: string;
  volume: number;
  position: number;
}

export interface Ritual {
  id: string;
  name: string;
  timerMode: TimerMode;
  /** Minutes for a focus phase; null means unbounded (stopwatch). */
  focusMinutes: number | null;
  /** Minutes for a break phase; null means this mode has no break phase. */
  breakMinutes: number | null;
  /** Number of focus cycles this ritual targets; null means unbounded. */
  cyclesTarget: number | null;
  /** The Focus Space to open with — a bundled scene id for Phase 3 (custom spaces are Phase 4). */
  spaceId: string | null;
  soundLayers: RitualSoundLayer[];
  isFavorite: boolean;
  lastUsedAt: number | null;
  createdAt: number;
  isArchived: boolean;
}

/** What starting a session from a ritual hands to timerStore.start(). */
export interface RitualSessionStart {
  mode: TimerMode;
  focusMinutes: number | null;
  breakMinutes: number | null;
  cyclesTarget: number | null;
  ritualId: string;
}
