import {
  advancePhase,
  cancel,
  computeElapsedMs,
  computeRemainingMs,
  continueFocus,
  createSession,
  isPhaseComplete,
  pause,
  reconcile,
  resume,
} from '../timer/timerEngine';
import type { TimerSession } from '../timer/types';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('computeElapsedMs / computeRemainingMs / isPhaseComplete', () => {
  it('accumulates from startedAt while running', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    expect(computeElapsedMs(session, T0 + 5 * MIN)).toBe(5 * MIN);
    expect(computeRemainingMs(session, T0 + 5 * MIN)).toBe(20 * MIN);
    expect(isPhaseComplete(session, T0 + 5 * MIN)).toBe(false);
  });

  it('freezes at accumulatedMs while paused', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const paused = pause(session, T0 + 5 * MIN);
    expect(paused.accumulatedMs).toBe(5 * MIN);
    expect(computeElapsedMs(paused, T0 + 50 * MIN)).toBe(5 * MIN);
  });

  it('resumes from a fresh startedAt without losing banked time', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const paused = pause(session, T0 + 5 * MIN);
    const resumed = resume(paused, T0 + 30 * MIN);
    expect(computeElapsedMs(resumed, T0 + 30 * MIN + 2 * MIN)).toBe(7 * MIN);
  });

  it('is unbounded for stopwatch (planned duration null)', () => {
    const session = createSession({ id: 's1', mode: 'stopwatch', now: T0 });
    expect(computeRemainingMs(session, T0 + 999 * MIN)).toBeNull();
    expect(isPhaseComplete(session, T0 + 999 * MIN)).toBe(false);
  });

  it('a throttled/missed tick never causes drift — same formula, any now', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const a = computeElapsedMs(session, T0 + 10 * MIN);
    const b = computeElapsedMs(session, T0 + 10 * MIN); // re-invoked, e.g. after a missed tick
    expect(a).toBe(b);
  });
});

describe('reconcile — single boundary (Pomodoro)', () => {
  it('auto-starts the break when focus completes', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const now = T0 + 25 * MIN + 30_000; // 30s past the 25-minute focus boundary
    const reconciled = reconcile(session, now);
    expect(reconciled.status).toBe('running');
    expect(reconciled.phase).toBe('break');
    expect(reconciled.cyclesCompleted).toBe(1);
    // overshoot preserved into the new phase, no time lost
    expect(computeElapsedMs(reconciled, now)).toBe(30_000);
  });
});

describe('reconcile — multiple elapsed phase boundaries', () => {
  it('fast-forwards through an auto-started break and halts before the next focus', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    // Locked through the full 25min focus + full 5min break + 1 extra minute.
    const now = T0 + 25 * MIN + 5 * MIN + MIN;
    const reconciled = reconcile(session, now);
    expect(reconciled.status).toBe('awaiting-start');
    expect(reconciled.phase).toBe('break'); // halts at the just-completed phase, doesn't guess focus started
    expect(reconciled.cyclesCompleted).toBe(1);
    expect(reconciled.startedAt).toBeNull();
    // clamped at 100% of the break's planned duration, not shown running over
    expect(computeElapsedMs(reconciled, now)).toBe(5 * MIN);
  });

  it('marks the whole session completed once cyclesTarget is reached', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0, cyclesTarget: 1 });
    const now = T0 + 25 * MIN + 5 * MIN + MIN;
    const reconciled = reconcile(session, now);
    expect(reconciled.status).toBe('completed');
    expect(reconciled.cyclesCompleted).toBe(1);
  });

  it('is idempotent once caught up — reconciling again at the same now is a no-op', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const now = T0 + 25 * MIN + 5 * MIN + MIN;
    const once = reconcile(session, now);
    const twice = reconcile(once, now);
    expect(twice).toEqual(once);
  });
});

describe('reconcile — Flow Mode', () => {
  it('halts at the focus boundary instead of auto-starting a break', () => {
    const session = createSession({ id: 's1', mode: 'flow', now: T0 }); // 45min soft focus target
    const now = T0 + 45 * MIN + 10_000;
    const reconciled = reconcile(session, now);
    expect(reconciled.status).toBe('awaiting-start');
    expect(reconciled.phase).toBe('focus'); // never advanced into break
    expect(reconciled.startedAt).toBeNull();
  });

  it('"keep the flow" extends the target and resumes without losing banked time', () => {
    const session = createSession({ id: 's1', mode: 'flow', now: T0 });
    const halted = reconcile(session, T0 + 45 * MIN + 10_000);
    const kept = continueFocus(halted, 20, T0 + 46 * MIN);
    expect(kept.status).toBe('running');
    expect(kept.phase).toBe('focus');
    expect(kept.focusMinutes).toBe(65);
    // still counts from the 45-minute mark that was already banked
    expect(computeElapsedMs(kept, T0 + 46 * MIN + MIN)).toBe(45 * MIN + MIN);
  });

  it('"take a break" from the halted decision advances into the break phase', () => {
    const session = createSession({ id: 's1', mode: 'flow', now: T0 });
    const halted = reconcile(session, T0 + 45 * MIN + 10_000);
    const onBreak = advancePhase(halted, T0 + 46 * MIN);
    expect(onBreak.status).toBe('running');
    expect(onBreak.phase).toBe('break');
    expect(onBreak.accumulatedMs).toBe(0);
  });
});

describe('advancePhase / continueFocus guard against wrong states', () => {
  it('advancePhase is a no-op unless status is awaiting-start', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    expect(advancePhase(session, T0 + MIN)).toBe(session);
  });

  it('continueFocus is a no-op unless awaiting-start on the focus phase', () => {
    const session = createSession({ id: 's1', mode: 'flow', now: T0 });
    expect(continueFocus(session, 10, T0 + MIN)).toBe(session);
  });
});

describe('cancel', () => {
  it('freezes elapsed time and clears startedAt', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const cancelled = cancel(session, T0 + 3 * MIN);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.accumulatedMs).toBe(3 * MIN);
    expect(cancelled.startedAt).toBeNull();
  });
});

describe('status type includes awaiting-start', () => {
  it('is assignable on a TimerSession', () => {
    const session: TimerSession = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const withStatus: TimerSession = { ...session, status: 'awaiting-start' };
    expect(withStatus.status).toBe('awaiting-start');
  });
});
