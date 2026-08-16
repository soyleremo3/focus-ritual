import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { generateId } from '@/domain/id';
import {
  advancePhase as advancePhaseEngine,
  cancel as cancelEngine,
  computeElapsedMs,
  computeRemainingMs,
  continueFocus as continueFocusEngine,
  createSession,
  pause as pauseEngine,
  reconcile,
  resume as resumeEngine,
} from '@/domain/timer/timerEngine';
import type { TimerMode, TimerSession } from '@/domain/timer/types';

const TICK_INTERVAL_MS = 300;

interface StartOptions {
  ritualId?: string | null;
  focusMinutes?: number | null;
  breakMinutes?: number | null;
  cyclesTarget?: number | null;
}

interface TimerStoreState {
  session: TimerSession | null;
  /** Bumped on every tick so subscribers re-render and recompute elapsed/remaining themselves. */
  tick: number;
  start: (mode: TimerMode, options?: StartOptions) => void;
  pause: () => void;
  resume: () => void;
  advancePhase: () => void;
  continueFocus: (extendMinutes: number) => void;
  cancel: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function stopInterval() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function startInterval() {
  if (intervalId != null) return;
  intervalId = setInterval(() => {
    useTimerStore.setState((state) => ({ tick: state.tick + 1 }));
  }, TICK_INTERVAL_MS);
}

export const useTimerStore = create<TimerStoreState>()((set, get) => ({
  session: null,
  tick: 0,

  start: (mode, options) => {
    const now = Date.now();
    const session = createSession({
      id: generateId(),
      mode,
      now,
      ritualId: options?.ritualId ?? null,
      focusMinutes: options?.focusMinutes,
      breakMinutes: options?.breakMinutes,
      cyclesTarget: options?.cyclesTarget,
    });
    set({ session });
    startInterval();
  },

  pause: () => {
    const { session } = get();
    if (!session) return;
    set({ session: pauseEngine(session, Date.now()) });
    stopInterval();
  },

  resume: () => {
    const { session } = get();
    if (!session) return;
    set({ session: resumeEngine(session, Date.now()) });
    startInterval();
  },

  advancePhase: () => {
    const { session } = get();
    if (!session) return;
    set({ session: advancePhaseEngine(session, Date.now()) });
    startInterval();
  },

  continueFocus: (extendMinutes) => {
    const { session } = get();
    if (!session) return;
    set({ session: continueFocusEngine(session, extendMinutes, Date.now()) });
    startInterval();
  },

  cancel: () => {
    const { session } = get();
    if (!session) return;
    set({ session: cancelEngine(session, Date.now()) });
    stopInterval();
  },
}));

/**
 * Own AppState subscription, set up once for the app's lifetime (this module is a
 * singleton). Background stops the interval only — timestamps are never mutated.
 * Foreground runs the deterministic reconcile() loop before restarting it.
 */
AppState.addEventListener('change', (next: AppStateStatus) => {
  if (next === 'background' || next === 'inactive') {
    stopInterval();
    return;
  }
  if (next === 'active') {
    const { session } = useTimerStore.getState();
    if (session && session.status === 'running') {
      const reconciled = reconcile(session, Date.now());
      useTimerStore.setState({ session: reconciled });
      if (reconciled.status === 'running') startInterval();
    }
  }
});

/** Re-renders on every tick so the returned value stays live while running. */
export function useElapsedMs(): number | null {
  const session = useTimerStore((s) => s.session);
  useTimerStore((s) => s.tick);
  return session ? computeElapsedMs(session, Date.now()) : null;
}

/** Re-renders on every tick so the returned value stays live while running. */
export function useRemainingMs(): number | null {
  const session = useTimerStore((s) => s.session);
  useTimerStore((s) => s.tick);
  return session ? computeRemainingMs(session, Date.now()) : null;
}
