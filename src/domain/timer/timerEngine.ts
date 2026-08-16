import { MODE_DEFAULTS, type TimerMode, type TimerPhase, type TimerSession } from './types';

function minutesToMs(minutes: number | null): number | null {
  return minutes == null ? null : minutes * 60_000;
}

function durationMsForPhase(session: TimerSession, phase: TimerPhase): number | null {
  return minutesToMs(phase === 'focus' ? session.focusMinutes : session.breakMinutes);
}

export function computeElapsedMs(session: TimerSession, now: number): number {
  if (session.status !== 'running') return session.accumulatedMs;
  return session.accumulatedMs + (now - (session.startedAt ?? now));
}

export function computeRemainingMs(session: TimerSession, now: number): number | null {
  const planned = durationMsForPhase(session, session.phase);
  if (planned == null) return null;
  return planned - computeElapsedMs(session, now);
}

export function isPhaseComplete(session: TimerSession, now: number): boolean {
  const planned = durationMsForPhase(session, session.phase);
  return planned != null && computeElapsedMs(session, now) >= planned;
}

export function otherPhase(phase: TimerPhase): TimerPhase {
  return phase === 'focus' ? 'break' : 'focus';
}

/**
 * Focus -> break auto-starts for every mode except Flow (idiomatic Pomodoro continuity).
 * Break -> next focus never auto-starts: resuming work is always a conscious action.
 * Flow's focus phase is a soft check-in interval, not a hard cutoff — it always halts
 * for a "Keep the flow?" decision instead of assuming a break was wanted.
 */
export function autoStarts(nextPhase: TimerPhase, mode: TimerMode): boolean {
  if (nextPhase === 'focus') return false;
  return mode !== 'flow';
}

export interface CreateSessionParams {
  id: string;
  mode: TimerMode;
  now: number;
  ritualId?: string | null;
  focusMinutes?: number | null;
  breakMinutes?: number | null;
  cyclesTarget?: number | null;
}

export function createSession(params: CreateSessionParams): TimerSession {
  const defaults = MODE_DEFAULTS[params.mode];
  return {
    id: params.id,
    ritualId: params.ritualId ?? null,
    mode: params.mode,
    phase: 'focus',
    status: 'running',
    startedAt: params.now,
    accumulatedMs: 0,
    focusMinutes: params.focusMinutes ?? defaults.focusMinutes,
    breakMinutes: params.breakMinutes ?? defaults.breakMinutes,
    cyclesTarget: params.cyclesTarget ?? defaults.cyclesTarget,
    cyclesCompleted: 0,
  };
}

export function pause(session: TimerSession, now: number): TimerSession {
  if (session.status !== 'running') return session;
  return { ...session, status: 'paused', accumulatedMs: computeElapsedMs(session, now), startedAt: null };
}

export function resume(session: TimerSession, now: number): TimerSession {
  if (session.status !== 'paused') return session;
  return { ...session, status: 'running', startedAt: now };
}

/** From `awaiting-start`, explicitly begin the next phase ("Start Focus" / "Start Break"). */
export function advancePhase(session: TimerSession, now: number): TimerSession {
  if (session.status !== 'awaiting-start') return session;
  return {
    ...session,
    phase: otherPhase(session.phase),
    status: 'running',
    accumulatedMs: 0,
    startedAt: now,
  };
}

/** Flow-only: "Keep the flow?" -> keep going. Extends the soft focus target and resumes. */
export function continueFocus(session: TimerSession, extendMinutes: number, now: number): TimerSession {
  if (session.status !== 'awaiting-start' || session.phase !== 'focus') return session;
  return {
    ...session,
    status: 'running',
    startedAt: now,
    focusMinutes: (session.focusMinutes ?? 0) + extendMinutes,
  };
}

export function cancel(session: TimerSession, now: number): TimerSession {
  return { ...session, status: 'cancelled', accumulatedMs: computeElapsedMs(session, now), startedAt: null };
}

/**
 * Deterministic reconciliation over every elapsed phase boundary — not a single check.
 * The phone could have been locked long enough to span more than one transition (focus
 * ends, break auto-starts, break also ends before foreground). Loops until it catches up
 * to `now`, hits a boundary that requires a user decision (awaiting-start), or the whole
 * session completes (cyclesTarget reached).
 */
export function reconcile(session: TimerSession, now: number): TimerSession {
  // Only a running session accrues wall-clock time to reconcile. A session that already
  // halted (awaiting-start), or is paused/completed/cancelled, has nothing further to
  // fast-forward — without this guard, calling reconcile() twice on an already-halted
  // session (the exact shape a persisted session is rehydrated in) would re-run the loop
  // body once more and double-count a phase completion.
  if (session.status !== 'running') return session;

  let current = session;

  while (isPhaseComplete(current, now)) {
    const planned = durationMsForPhase(current, current.phase);
    if (planned == null) break; // unreachable given isPhaseComplete's guard, keeps TS happy

    const overshootMs = computeElapsedMs(current, now) - planned;
    const nextPhase = otherPhase(current.phase);
    const cyclesCompleted = current.phase === 'focus' ? current.cyclesCompleted + 1 : current.cyclesCompleted;

    if (nextPhase === 'focus' && current.cyclesTarget != null && cyclesCompleted >= current.cyclesTarget) {
      current = {
        ...current,
        status: 'completed',
        cyclesCompleted,
        accumulatedMs: planned,
        startedAt: null,
      };
      break;
    }

    if (autoStarts(nextPhase, current.mode)) {
      current = {
        ...current,
        phase: nextPhase,
        status: 'running',
        cyclesCompleted,
        accumulatedMs: 0,
        startedAt: now - overshootMs,
      };
      // loop again — this same overshoot may already complete the new phase too
    } else {
      current = {
        ...current,
        status: 'awaiting-start',
        cyclesCompleted,
        accumulatedMs: planned,
        startedAt: null,
      };
      break;
    }
  }

  return current;
}
