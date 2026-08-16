import { createSession, pause } from '../timer/timerEngine';
import { planPhaseEndNotification } from '../notifications/notificationPlan';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe('planPhaseEndNotification', () => {
  it('plans a focus-phase notification firing at the remaining time from now', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const plan = planPhaseEndNotification(session, T0 + 5 * MIN);
    expect(plan).not.toBeNull();
    expect(plan?.fireAtMs).toBe(T0 + 25 * MIN); // 20min remaining from T0+5min
    expect(plan?.title).toBe('Focus complete');
  });

  it('plans a break-phase notification with break-specific copy', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const onBreak = { ...session, phase: 'break' as const, focusMinutes: null, breakMinutes: 5, startedAt: T0 };
    const plan = planPhaseEndNotification(onBreak, T0 + MIN);
    expect(plan).not.toBeNull();
    expect(plan?.fireAtMs).toBe(T0 + 5 * MIN);
    expect(plan?.title).toBe('Break complete');
  });

  it('returns null when the session is not running', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const paused = pause(session, T0 + MIN);
    expect(planPhaseEndNotification(paused, T0 + 2 * MIN)).toBeNull();
  });

  it('returns null for a mode/phase with no planned duration (stopwatch)', () => {
    const session = createSession({ id: 's1', mode: 'stopwatch', now: T0 });
    expect(planPhaseEndNotification(session, T0 + 5 * MIN)).toBeNull();
  });

  it('returns null once the phase boundary has already passed', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    expect(planPhaseEndNotification(session, T0 + 26 * MIN)).toBeNull();
  });

  it('accounts for time already elapsed before the resume that made it running again', () => {
    const session = createSession({ id: 's1', mode: 'pomodoro', now: T0 });
    const paused = pause(session, T0 + 10 * MIN);
    const resumed = { ...paused, status: 'running' as const, startedAt: T0 + 15 * MIN };
    const plan = planPhaseEndNotification(resumed, T0 + 15 * MIN);
    expect(plan?.fireAtMs).toBe(T0 + 15 * MIN + 15 * MIN); // 25min planned - 10min already elapsed
  });
});
