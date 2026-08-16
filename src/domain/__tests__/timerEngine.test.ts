import {
  advancePhase,
  autoStarts,
  cancel,
  computeElapsedMs,
  computeRemainingMs,
  computeTotalFocusMs,
  continueFocus,
  createSession,
  finish,
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

  it('reconciling an already-halted session again is a true no-op, not just equal by luck', () => {
    // Regression: a session rehydrated from persistence may already be awaiting-start —
    // reconcile() must not re-run its boundary-crossing logic against it.
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const halted = reconcile(session, T0 + 25 * MIN + 5 * MIN + MIN);
    expect(halted.status).toBe('awaiting-start');

    const reconciledAgain = reconcile(halted, T0 + 999 * MIN); // much later `now`, still a no-op
    expect(reconciledAgain).toBe(halted); // same reference — short-circuited, not rebuilt
  });

  it('does not double-count cyclesCompleted when reconciled twice after halting on a focus boundary', () => {
    // Flow is the one mode that halts on a *focus* completion — cyclesCompleted correctly
    // increments to 1 the moment that focus block finishes (whether or not a break
    // follows). This is the shape that exposed the bug: the halt branch previously didn't
    // guard against re-entering the loop, so a second reconcile() re-incremented it to 2.
    const session = createSession({ id: 's1', mode: 'flow', now: T0 });
    const halted = reconcile(session, T0 + 45 * MIN + 10_000);
    expect(halted.cyclesCompleted).toBe(1);

    const reconciledAgain = reconcile(halted, T0 + 45 * MIN + 10_000);
    expect(reconciledAgain.cyclesCompleted).toBe(1);
    expect(reconciledAgain).toEqual(halted);
  });

  it('is a no-op for paused, completed, and cancelled sessions regardless of elapsed time', () => {
    const running = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const paused = pause(running, T0 + MIN);
    expect(reconcile(paused, T0 + 999 * MIN)).toBe(paused);

    const cancelled = cancel(running, T0 + MIN);
    expect(reconcile(cancelled, T0 + 999 * MIN)).toBe(cancelled);
  });
});

describe('reconcile — self-heals a corrupted running-but-no-startedAt session', () => {
  it('heals to a fresh resume-from-now rather than fabricating elapsed time it cannot know', () => {
    // Should never occur from any real domain transition, but if stale/corrupted state
    // ever produces it, computeElapsedMs would freeze at accumulatedMs forever (nothing
    // to add `now - startedAt` to), so isPhaseComplete would never trip and this session
    // could never reconcile past this point without the self-heal. There's no valid
    // startedAt to measure real elapsed time from, so healing anchors to *this* reconcile
    // call's `now` (same as resume()) rather than guessing — accumulatedMs is kept as-is.
    const corrupted: TimerSession = {
      ...createSession({ id: 's1', mode: 'pomodoro', now: T0 }),
      startedAt: null,
      accumulatedMs: 20 * MIN,
    };
    const healedAt = T0 + 999 * MIN; // however much later this is first reconciled
    const reconciled = reconcile(corrupted, healedAt);
    expect(reconciled.status).toBe('running'); // 20min < 25min planned — not complete yet
    expect(reconciled.phase).toBe('focus');
    expect(reconciled.startedAt).not.toBeNull();
    expect(computeElapsedMs(reconciled, healedAt)).toBe(20 * MIN);

    // From here it behaves like any normal running session — a later reconcile advances it.
    const further = reconcile(reconciled, healedAt + 6 * MIN);
    expect(further.status).toBe('running');
    expect(further.phase).toBe('break');
  });

  it('preserves the already-accumulated time exactly — the heal does not lose or add elapsed time', () => {
    const corrupted: TimerSession = {
      ...createSession({ id: 's1', mode: 'deepWork', now: T0 }),
      startedAt: null,
      accumulatedMs: 10 * MIN,
    };
    // now === the healed startedAt, so computeElapsedMs should read back exactly 10min.
    const reconciled = reconcile(corrupted, T0 + 999 * MIN);
    expect(computeElapsedMs(reconciled, T0 + 999 * MIN)).toBe(10 * MIN);
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

  it('is a no-op once already completed — a cancel racing a completion must never revert it', () => {
    const session = createSession({ id: 's1', mode: 'deepWork', now: T0 });
    const completed = finish(session, T0 + 10 * MIN);
    expect(cancel(completed, T0 + 11 * MIN)).toBe(completed);
  });

  it('is a no-op once already cancelled', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const cancelled = cancel(session, T0 + MIN);
    expect(cancel(cancelled, T0 + 2 * MIN)).toBe(cancelled);
  });

  it('still works from paused and from an awaiting-start halt', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const paused = pause(session, T0 + MIN);
    expect(cancel(paused, T0 + 5 * MIN).status).toBe('cancelled');

    const halted = reconcile(createSession({ id: 's2', mode: 'flow', now: T0 }), T0 + 45 * MIN + 10_000);
    expect(halted.status).toBe('awaiting-start');
    expect(cancel(halted, T0 + 46 * MIN).status).toBe('cancelled');
  });
});

describe('bankedFocusMs / computeTotalFocusMs', () => {
  it('starts at 0 and stays 0 while nothing has closed out a focus phase yet', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    expect(session.bankedFocusMs).toBe(0);
    expect(computeTotalFocusMs(session, T0 + 10 * MIN)).toBe(10 * MIN);
  });

  it('a break phase does not contribute to total focus time', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const onBreak = reconcile(session, T0 + 25 * MIN + 30_000); // completes focus, auto-starts break
    expect(onBreak.phase).toBe('break');
    expect(onBreak.bankedFocusMs).toBe(25 * MIN);
    // 3 more minutes elapse into the break — must not add to focus time.
    expect(computeTotalFocusMs(onBreak, T0 + 25 * MIN + 30_000 + 3 * MIN)).toBe(25 * MIN);
  });

  it('accumulates across every focus phase of a multi-cycle session, not just the last one', () => {
    // cyclesTarget: 1 pomodoro = one full focus+break cycle before completing.
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0, cyclesTarget: 1 });
    const now = T0 + 25 * MIN + 5 * MIN + MIN; // locked through focus + break + 1 extra minute
    const completed = reconcile(session, now);
    expect(completed.status).toBe('completed');
    // Only the 25-minute focus phase counts — the 5-minute break that followed does not,
    // even though accumulatedMs itself reflects the break (the *last* phase touched).
    expect(completed.bankedFocusMs).toBe(25 * MIN);
    expect(computeTotalFocusMs(completed, now)).toBe(25 * MIN);
  });

  it('is preserved (not reset) by a pause/resume within the same focus phase', () => {
    const session = createSession({ id: 's1', mode: 'deepWork', now: T0 });
    const paused = pause(session, T0 + 10 * MIN);
    const resumed = resume(paused, T0 + 20 * MIN);
    expect(computeTotalFocusMs(resumed, T0 + 25 * MIN)).toBe(15 * MIN); // 10 before pause + 5 after resume
  });

  it('reconciling an already-completed session twice never double-counts bankedFocusMs', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0, cyclesTarget: 1 });
    const now = T0 + 25 * MIN + 5 * MIN + MIN;
    const once = reconcile(session, now);
    const twice = reconcile(once, T0 + 999 * MIN);
    expect(twice).toBe(once); // short-circuited by the status guard, not just numerically equal
    expect(twice.bankedFocusMs).toBe(25 * MIN);
  });
});

describe('autoStarts settings', () => {
  it('defaults to auto-starting breaks but never the next focus (unchanged legacy behavior)', () => {
    expect(autoStarts('break', 'pomodoro')).toBe(true);
    expect(autoStarts('focus', 'pomodoro')).toBe(false);
  });

  it('autoStartBreaks: false halts at the focus/break boundary instead of auto-starting', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const settings = { autoStartBreaks: false, autoStartNextFocus: false };
    const halted = reconcile(session, T0 + 25 * MIN + 30_000, settings);
    expect(halted.status).toBe('awaiting-start');
    expect(halted.phase).toBe('focus'); // unchanged — reconcile halts before flipping phase
  });

  it('autoStartNextFocus: true auto-starts the next focus phase after a break', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const settings = { autoStartBreaks: true, autoStartNextFocus: true };
    // 25min focus + 5min break + 1s: both boundaries crossed in one reconcile call.
    const result = reconcile(session, T0 + 25 * MIN + 5 * MIN + 1_000, settings);
    expect(result.status).toBe('running');
    expect(result.phase).toBe('focus');
    expect(result.cyclesCompleted).toBe(1);
  });

  it("Flow's break decision stays deliberate even when autoStartBreaks is true", () => {
    const session = createSession({ id: 's1', mode: 'flow', now: T0 });
    const settings = { autoStartBreaks: true, autoStartNextFocus: false };
    const halted = reconcile(session, T0 + 45 * MIN + 10_000, settings);
    expect(halted.status).toBe('awaiting-start');
    expect(halted.phase).toBe('focus');
  });
});

describe('finish', () => {
  it('marks an open-ended running session completed and banks its live elapsed time', () => {
    const session = createSession({ id: 's1', mode: 'deepWork', now: T0 });
    const finished = finish(session, T0 + 32 * MIN);
    expect(finished.status).toBe('completed');
    expect(finished.startedAt).toBeNull();
    expect(finished.accumulatedMs).toBe(32 * MIN);
    expect(computeTotalFocusMs(finished, T0 + 32 * MIN)).toBe(32 * MIN);
  });

  it('works from paused without losing the frozen elapsed time', () => {
    const session = createSession({ id: 's1', mode: 'stopwatch', now: T0 });
    const paused = pause(session, T0 + 8 * MIN);
    const finished = finish(paused, T0 + 500 * MIN); // long after pausing — must not count the gap
    expect(finished.status).toBe('completed');
    expect(finished.accumulatedMs).toBe(8 * MIN);
  });

  it('works from an awaiting-start phase boundary (e.g. Flow\'s "keep the flow?" halt)', () => {
    const session = createSession({ id: 's1', mode: 'flow', now: T0 });
    const halted = reconcile(session, T0 + 45 * MIN + 10_000); // halts awaiting-start, phase still 'focus'
    const finished = finish(halted, T0 + 46 * MIN);
    expect(finished.status).toBe('completed');
    expect(computeTotalFocusMs(finished, T0 + 46 * MIN)).toBe(45 * MIN);
  });

  it('finishing while paused on a break phase does not credit that time as focus time', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const onBreak = reconcile(session, T0 + 25 * MIN + 30_000);
    const pausedOnBreak = pause(onBreak, T0 + 25 * MIN + 30_000 + 2 * MIN);
    const finished = finish(pausedOnBreak, T0 + 999 * MIN);
    expect(finished.phase).toBe('break');
    expect(computeTotalFocusMs(finished, T0 + 999 * MIN)).toBe(25 * MIN); // only the focus phase before it
  });

  it('is a no-op once already completed or cancelled', () => {
    const session = createSession({ id: 's1', mode: 'deepWork', now: T0 });
    const cancelled = cancel(session, T0 + MIN);
    expect(finish(cancelled, T0 + 999 * MIN)).toBe(cancelled);
  });
});

describe('status type includes awaiting-start', () => {
  it('is assignable on a TimerSession', () => {
    const session: TimerSession = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const withStatus: TimerSession = { ...session, status: 'awaiting-start' };
    expect(withStatus.status).toBe('awaiting-start');
  });
});
