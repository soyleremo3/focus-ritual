import { computeRemainingMs } from '../timer/timerEngine';
import type { TimerPhase, TimerSession } from '../timer/types';

export interface NotificationPlan {
  fireAtMs: number;
  title: string;
  body: string;
}

const PHASE_END_MESSAGES: Record<TimerPhase, { title: string; body: string }> = {
  focus: { title: 'Focus complete', body: 'Nice work — time for a break.' },
  break: { title: 'Break complete', body: 'Ready to focus again?' },
};

/**
 * What notification (if any) should be scheduled right now for the session's current
 * phase boundary — pure and framework-independent, so the "what" is unit-tested
 * independently of the "how" (lib/notifications/scheduler.ts's expo-notifications calls).
 * Returns null when there's nothing to wait for: the session isn't running, this phase has
 * no planned duration (stopwatch, or any mode's break when breakMinutes is null), or the
 * boundary has already passed (reconcile() should run first in that case, not this).
 */
export function planPhaseEndNotification(session: TimerSession, now: number): NotificationPlan | null {
  if (session.status !== 'running') return null;
  const remaining = computeRemainingMs(session, now);
  if (remaining == null || remaining <= 0) return null;
  const { title, body } = PHASE_END_MESSAGES[session.phase];
  return { fireAtMs: now + remaining, title, body };
}
