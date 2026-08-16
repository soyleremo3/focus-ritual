import { computeTotalFocusMs } from '../timer/timerEngine';
import type { TimerSession } from '../timer/types';

/**
 * Every function here takes an already-fetched TimerSession[] (typically
 * sessionsRepo.listTerminalSessions()'s result) and derives everything else — no DB
 * access, no Date.now() side effects, fully deterministic and unit-testable. `now` is
 * never needed: computeTotalFocusMs is a no-op past `now` for any non-'running' session,
 * and every session passed in here is terminal (completed/cancelled) by construction.
 */
function totalFocusMsOf(session: TimerSession): number {
  return computeTotalFocusMs(session, session.createdAt);
}

/**
 * Cancelled sessions stay visible in History (see HistoryScreen's session list) but are
 * excluded from every productivity aggregate below — a session abandoned after 30 seconds
 * shouldn't count the same as one seen through to completion or ended deliberately via finish().
 */
function isProductive(session: TimerSession): boolean {
  return session.status !== 'cancelled';
}

export interface StatsSummary {
  totalFocusMs: number;
  sessionCount: number;
}

export function summarize(sessions: TimerSession[]): StatsSummary {
  const productive = sessions.filter(isProductive);
  return {
    totalFocusMs: productive.reduce((sum, s) => sum + totalFocusMsOf(s), 0),
    sessionCount: productive.length,
  };
}

/** [startMs, endMs) — half-open, so consecutive ranges never double-count a boundary session. */
export function filterSessionsInRange(sessions: TimerSession[], startMs: number, endMs: number): TimerSession[] {
  return sessions.filter((s) => s.createdAt >= startMs && s.createdAt < endMs);
}

export function startOfDay(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(epochMs: number, days: number): number {
  const d = new Date(epochMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** weekStartsOn: 0 = Sunday, 1 = Monday. */
export function startOfWeek(epochMs: number, weekStartsOn: 0 | 1 = 0): number {
  const dayStart = startOfDay(epochMs);
  const dayOfWeek = new Date(dayStart).getDay();
  const diff = (dayOfWeek - weekStartsOn + 7) % 7;
  return addDays(dayStart, -diff);
}

export function startOfMonth(epochMs: number): number {
  const d = new Date(epochMs);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DayBucket {
  dateMs: number;
  totalFocusMs: number;
  sessionCount: number;
}

/** 7 buckets, oldest to newest, ending on the day containing `todayMs` — a simple daily bar chart's data source. */
export function last7DaysBuckets(sessions: TimerSession[], todayMs: number): DayBucket[] {
  const today = startOfDay(todayMs);
  const buckets: DayBucket[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dayStart = addDays(today, -i);
    const dayEnd = addDays(dayStart, 1);
    const { totalFocusMs, sessionCount } = summarize(filterSessionsInRange(sessions, dayStart, dayEnd));
    buckets.push({ dateMs: dayStart, totalFocusMs, sessionCount });
  }
  return buckets;
}

export interface BreakdownEntry {
  /** null = sessions with no ritual/task attached ("Freeform" / "No task"). */
  key: string | null;
  totalFocusMs: number;
  sessionCount: number;
}

/** Sorted by totalFocusMs descending; ties keep their original relative order (stable sort). */
function groupBy(sessions: TimerSession[], keyFn: (s: TimerSession) => string | null): BreakdownEntry[] {
  const totals = new Map<string | null, { totalFocusMs: number; sessionCount: number }>();
  for (const s of sessions.filter(isProductive)) {
    const key = keyFn(s);
    const entry = totals.get(key) ?? { totalFocusMs: 0, sessionCount: 0 };
    entry.totalFocusMs += totalFocusMsOf(s);
    entry.sessionCount += 1;
    totals.set(key, entry);
  }
  return [...totals.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.totalFocusMs - a.totalFocusMs);
}

/** "Category" breakdown — grouped by ritual, since a Ritual is this app's closest concept to a focus category. */
export function groupByRitual(sessions: TimerSession[]): BreakdownEntry[] {
  return groupBy(sessions, (s) => s.ritualId);
}

export function groupByTask(sessions: TimerSession[]): BreakdownEntry[] {
  return groupBy(sessions, (s) => s.taskId);
}

/** The ritual with the most total focus time in the given sessions; null if none were ritual-linked. */
export function favoriteRitualId(sessions: TimerSession[]): string | null {
  return groupByRitual(sessions).find((entry) => entry.key != null)?.key ?? null;
}

export type TimeOfDaySegment = 'morning' | 'afternoon' | 'evening' | 'night';

export const TIME_OF_DAY_LABELS: Record<TimeOfDaySegment, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

const TIME_OF_DAY_ORDER: TimeOfDaySegment[] = ['morning', 'afternoon', 'evening', 'night'];

function segmentForHour(hour: number): TimeOfDaySegment {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Which broad time-of-day segment has the most accumulated focus time; null if there's no focus time at all. */
export function bestFocusSegment(sessions: TimerSession[]): TimeOfDaySegment | null {
  const totals: Record<TimeOfDaySegment, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const s of sessions.filter(isProductive)) {
    totals[segmentForHour(new Date(s.createdAt).getHours())] += totalFocusMsOf(s);
  }

  let best: TimeOfDaySegment | null = null;
  let bestMs = 0;
  for (const segment of TIME_OF_DAY_ORDER) {
    if (totals[segment] > bestMs) {
      bestMs = totals[segment];
      best = segment;
    }
  }
  return best;
}

export interface WeekdayTotal {
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  dayOfWeek: number;
  totalFocusMs: number;
}

export const WEEKDAY_SHORT_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Always 7 entries, ordered starting from weekStartsOn — which days of the week the user tends to focus on. */
export function weeklyRhythm(sessions: TimerSession[], weekStartsOn: 0 | 1 = 0): WeekdayTotal[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const s of sessions.filter(isProductive)) {
    const day = new Date(s.createdAt).getDay();
    totals[day] = (totals[day] ?? 0) + totalFocusMsOf(s);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const dayOfWeek = (weekStartsOn + i) % 7;
    return { dayOfWeek, totalFocusMs: totals[dayOfWeek] ?? 0 };
  });
}

/** "2h 15m" / "45m" / "< 1m" — never a bare "0m", since that reads as broken rather than empty. */
export function formatFocusDuration(ms: number): string {
  if (ms < 60_000) return '< 1m';
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
