import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import { getActiveSession, upsertSession } from '@/db/repositories/sessionsRepo';
import { generateId } from '@/domain/id';
import {
  advancePhase as advancePhaseEngine,
  cancel as cancelEngine,
  computeElapsedMs,
  computeRemainingMs,
  continueFocus as continueFocusEngine,
  createSession,
  finish as finishEngine,
  isPhaseComplete,
  pause as pauseEngine,
  reconcile,
  resume as resumeEngine,
  type AutoStartSettings,
} from '@/domain/timer/timerEngine';
import type { TimerMode, TimerSession } from '@/domain/timer/types';
import * as haptics from '@/lib/haptics';
import { planPhaseEndNotification } from '@/domain/notifications/notificationPlan';
import {
  cancelPhaseEndNotification,
  ensureNotificationPermission,
  schedulePhaseEndNotification,
} from '@/lib/notifications/scheduler';
import { useSettingsStore } from '@/store/settingsStore';

const TICK_INTERVAL_MS = 300;

const ACTIVE_STATUSES = new Set<TimerSession['status']>(['running', 'paused', 'awaiting-start']);

function currentAutoStartSettings(): AutoStartSettings {
  const { autoStartBreaks, autoStartNextFocus } = useSettingsStore.getState().settings;
  return { autoStartBreaks, autoStartNextFocus };
}

/**
 * Reschedules (or cancels) the session's phase-end notification against a single fixed
 * identifier — see scheduler.ts. Called after every state-changing action and every
 * reconcile() call site (AppState foreground, cold-start hydrate, and the live tick-loop
 * fix above), so pause/resume/reset/finish/cancel/app-restart/recovered-session all stay
 * correct without any of them needing to track a notification ID themselves.
 */
function syncNotification(session: TimerSession | null, now: number): void {
  const plan = session ? planPhaseEndNotification(session, now) : null;
  if (!plan || !useSettingsStore.getState().settings.notificationsEnabled) {
    void cancelPhaseEndNotification();
    return;
  }
  ensureNotificationPermission()
    .then((granted) => (granted ? schedulePhaseEndNotification(plan) : cancelPhaseEndNotification()))
    .catch((error: unknown) => {
      console.error('[timerStore] failed to sync notification', error);
    });
}

interface StartOptions {
  ritualId?: string | null;
  taskId?: string | null;
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
  finish: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function stopInterval() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Most ticks just bump the render counter — computeElapsedMs/computeRemainingMs derive the
 * live values, so nothing else is needed. But if the phase boundary was crossed since the
 * last tick, reconcile() must run right here too: it previously only ran on an AppState
 * background->foreground transition or cold-start hydrate(), so a session that stayed
 * foregrounded for its *entire* duration (the common case — someone watching the ring count
 * down) never left 'running' on its own. The clock would hit 00:00 and freeze there, with
 * Pause/Cancel/Finish still showing, until the user happened to background/foreground the
 * app. success() fires only from this live path — reconcile() running later because of a
 * background/foreground cycle or a cold start means the user wasn't looking, so a haptic
 * then would be a non sequitur rather than useful feedback.
 */
function startInterval() {
  if (intervalId != null) return;
  intervalId = setInterval(() => {
    const { session } = useTimerStore.getState();
    if (session && session.status === 'running') {
      const now = Date.now();
      if (isPhaseComplete(session, now)) {
        const reconciled = reconcile(session, now, currentAutoStartSettings());
        useTimerStore.setState((state) => ({ session: reconciled, tick: state.tick + 1 }));
        if (reconciled.status !== 'running') stopInterval();
        persistSession(reconciled, now);
        syncNotification(reconciled, now);
        haptics.success();
        return;
      }
    }
    useTimerStore.setState((state) => ({ tick: state.tick + 1 }));
  }, TICK_INTERVAL_MS);
}

/**
 * Fire-and-forget persistence — store actions stay synchronous so call sites don't need
 * to await them. getDatabase() is memoized, so this reuses the same connection every
 * action ever opens.
 */
function persistSession(session: TimerSession, now: number): void {
  getDatabase()
    .then((db) => upsertSession(db, session, now))
    .catch((error: unknown) => {
      console.error('[timerStore] failed to persist session', error);
    });
}

export const useTimerStore = create<TimerStoreState>()((set, get) => ({
  session: null,
  tick: 0,

  start: (mode, options) => {
    const now = Date.now();
    const { session: existing } = get();
    if (existing && ACTIVE_STATUSES.has(existing.status)) {
      // Starting a new session implicitly ends whatever was active — without this, the
      // previous session is simply dropped from the store while its DB row stays
      // 'running' forever: a zombie invisible to History (only completed/cancelled are
      // listed) that getActiveSession will never surface again once the new session
      // starts writing more recent updated_at timestamps. Reachable via normal
      // navigation — e.g. starting a ritual from the Rituals tab while another session
      // is already running.
      persistSession(cancelEngine(existing, now), now);
    }
    const session = createSession({
      id: generateId(),
      mode,
      now,
      ritualId: options?.ritualId ?? null,
      taskId: options?.taskId ?? null,
      focusMinutes: options?.focusMinutes,
      breakMinutes: options?.breakMinutes,
      cyclesTarget: options?.cyclesTarget,
    });
    set({ session });
    startInterval();
    persistSession(session, now);
    syncNotification(session, now);
  },

  pause: () => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    const next = pauseEngine(session, now);
    set({ session: next });
    stopInterval();
    persistSession(next, now);
    syncNotification(next, now);
  },

  resume: () => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    const next = resumeEngine(session, now);
    set({ session: next });
    startInterval();
    persistSession(next, now);
    syncNotification(next, now);
  },

  advancePhase: () => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    const next = advancePhaseEngine(session, now);
    set({ session: next });
    startInterval();
    persistSession(next, now);
    syncNotification(next, now);
  },

  continueFocus: (extendMinutes) => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    const next = continueFocusEngine(session, extendMinutes, now);
    set({ session: next });
    startInterval();
    persistSession(next, now);
    syncNotification(next, now);
  },

  cancel: () => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    const next = cancelEngine(session, now);
    set({ session: next });
    stopInterval();
    persistSession(next, now);
    syncNotification(next, now);
  },

  finish: () => {
    const { session } = get();
    if (!session) return;
    const now = Date.now();
    const next = finishEngine(session, now);
    set({ session: next });
    stopInterval();
    persistSession(next, now);
    syncNotification(next, now);
  },
}));

/**
 * Own AppState subscription, set up once for the app's lifetime (this module is a
 * singleton). Background stops the interval only — timestamps are never mutated.
 * Foreground runs the deterministic reconcile() loop before restarting it, and persists
 * the reconciled result so a kill immediately after foregrounding doesn't lose it.
 */
AppState.addEventListener('change', (next: AppStateStatus) => {
  if (next === 'background' || next === 'inactive') {
    stopInterval();
    return;
  }
  if (next === 'active') {
    const { session } = useTimerStore.getState();
    if (session && session.status === 'running') {
      const now = Date.now();
      const reconciled = reconcile(session, now, currentAutoStartSettings());
      useTimerStore.setState({ session: reconciled });
      if (reconciled.status === 'running') startInterval();
      persistSession(reconciled, now);
      syncNotification(reconciled, now);
    }
  }
});

/**
 * Cold-start recovery — runs once at module load. Reads the most recently updated
 * active session (if any survived a kill), reconciles it against the current time with
 * the exact same reconcile() used for backgrounding (a kill is just an extreme case of
 * "the app wasn't running for a while"), and persists the reconciled result back.
 */
async function hydrate(): Promise<void> {
  try {
    const db = await getDatabase();
    const active = await getActiveSession(db);
    if (!active) return;

    // A slow first boot can let the user tap Start (or recover a different session via
    // some other path) before this resolves — without this guard, hydrate() would
    // unconditionally clobber that already-in-progress session with the stale row read
    // above, and the user's new session becomes an invisible zombie row in exactly the
    // same way start()'s own guard (above) prevents.
    if (useTimerStore.getState().session) return;

    const now = Date.now();
    const reconciled = reconcile(active, now, currentAutoStartSettings());
    useTimerStore.setState({ session: reconciled });
    if (reconciled.status === 'running') startInterval();
    await upsertSession(db, reconciled, now);
    syncNotification(reconciled, now);
  } catch (error) {
    console.error('[timerStore] failed to hydrate session', error);
  }
}

void hydrate();

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
