import {
  addDays,
  bestFocusSegment,
  favoriteRitualId,
  filterSessionsInRange,
  formatFocusDuration,
  groupByRitual,
  groupByTask,
  last7DaysBuckets,
  startOfDay,
  startOfMonth,
  startOfWeek,
  summarize,
  weeklyRhythm,
} from '../stats/statsAggregation';
import type { TimerSession } from '../timer/types';

let nextId = 0;

/** A terminal (completed) session with a known total focus time — phase 'break' so
 * bankedFocusMs alone determines computeTotalFocusMs, independent of accumulatedMs. */
function makeSession(overrides: Partial<TimerSession> & { totalFocusMs: number; createdAt: number }): TimerSession {
  nextId += 1;
  const { totalFocusMs, ...rest } = overrides;
  return {
    id: `s${nextId}`,
    ritualId: null,
    taskId: null,
    mode: 'pomodoro',
    phase: 'break',
    status: 'completed',
    startedAt: null,
    accumulatedMs: 0,
    bankedFocusMs: totalFocusMs,
    focusMinutes: 25,
    breakMinutes: 5,
    cyclesTarget: null,
    cyclesCompleted: 1,
    ...rest,
  };
}

function localTime(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, month, day, hour, minute).getTime();
}

describe('summarize', () => {
  test('empty input', () => {
    expect(summarize([])).toEqual({ totalFocusMs: 0, sessionCount: 0 });
  });

  test('sums totalFocusMs across sessions', () => {
    const sessions = [
      makeSession({ totalFocusMs: 10 * 60_000, createdAt: localTime(2024, 0, 15) }),
      makeSession({ totalFocusMs: 25 * 60_000, createdAt: localTime(2024, 0, 15) }),
    ];
    expect(summarize(sessions)).toEqual({ totalFocusMs: 35 * 60_000, sessionCount: 2 });
  });
});

describe('filterSessionsInRange', () => {
  test('is half-open — includes start, excludes end', () => {
    const sessions = [
      makeSession({ totalFocusMs: 0, createdAt: 100 }),
      makeSession({ totalFocusMs: 0, createdAt: 200 }),
      makeSession({ totalFocusMs: 0, createdAt: 300 }),
    ];
    const result = filterSessionsInRange(sessions, 100, 300);
    expect(result.map((s) => s.createdAt)).toEqual([100, 200]);
  });
});

describe('date bucketing', () => {
  test('startOfDay zeroes out the time', () => {
    const noon = localTime(2024, 2, 10, 14, 37);
    expect(startOfDay(noon)).toBe(localTime(2024, 2, 10, 0, 0));
  });

  test('startOfWeek with Sunday start', () => {
    // March 13 2024 is a Wednesday.
    const wednesday = localTime(2024, 2, 13, 9, 0);
    expect(startOfWeek(wednesday, 0)).toBe(startOfDay(localTime(2024, 2, 10))); // preceding Sunday
  });

  test('startOfWeek with Monday start', () => {
    const wednesday = localTime(2024, 2, 13, 9, 0);
    expect(startOfWeek(wednesday, 1)).toBe(startOfDay(localTime(2024, 2, 11))); // preceding Monday
  });

  test('startOfMonth zeroes the day and time', () => {
    expect(startOfMonth(localTime(2024, 4, 27, 23, 59))).toBe(localTime(2024, 4, 1, 0, 0));
  });

  test('addDays crosses month boundaries correctly', () => {
    expect(addDays(localTime(2024, 1, 28), 2)).toBe(localTime(2024, 2, 1)); // 2024 is a leap year
  });
});

describe('last7DaysBuckets', () => {
  test('returns 7 buckets, oldest to newest, ending on today', () => {
    const today = localTime(2024, 5, 15, 10, 0);
    const buckets = last7DaysBuckets([], today);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]?.dateMs).toBe(startOfDay(localTime(2024, 5, 9)));
    expect(buckets[6]?.dateMs).toBe(startOfDay(localTime(2024, 5, 15)));
  });

  test('assigns each session to the correct day and never leaks across boundaries', () => {
    const today = localTime(2024, 5, 15, 10, 0);
    const sessions = [
      makeSession({ totalFocusMs: 30 * 60_000, createdAt: localTime(2024, 5, 15, 8, 0) }),
      makeSession({ totalFocusMs: 20 * 60_000, createdAt: localTime(2024, 5, 14, 23, 59) }),
      makeSession({ totalFocusMs: 999 * 60_000, createdAt: localTime(2024, 5, 8, 12, 0) }), // outside the 7-day window
    ];
    const buckets = last7DaysBuckets(sessions, today);
    const todayBucket = buckets.find((b) => b.dateMs === startOfDay(localTime(2024, 5, 15)));
    const yesterdayBucket = buckets.find((b) => b.dateMs === startOfDay(localTime(2024, 5, 14)));
    expect(todayBucket?.totalFocusMs).toBe(30 * 60_000);
    expect(yesterdayBucket?.totalFocusMs).toBe(20 * 60_000);
    expect(buckets.reduce((sum, b) => sum + b.totalFocusMs, 0)).toBe(50 * 60_000); // the 999m session excluded
  });
});

describe('groupByRitual / groupByTask', () => {
  test('groups by key, sums per group, sorts by totalFocusMs descending', () => {
    const sessions = [
      makeSession({ totalFocusMs: 10 * 60_000, createdAt: 0, ritualId: 'r1' }),
      makeSession({ totalFocusMs: 40 * 60_000, createdAt: 0, ritualId: 'r2' }),
      makeSession({ totalFocusMs: 5 * 60_000, createdAt: 0, ritualId: 'r1' }),
    ];
    const breakdown = groupByRitual(sessions);
    expect(breakdown).toEqual([
      { key: 'r2', totalFocusMs: 40 * 60_000, sessionCount: 1 },
      { key: 'r1', totalFocusMs: 15 * 60_000, sessionCount: 2 },
    ]);
  });

  test('sessions with no ritual/task land in the null bucket', () => {
    const sessions = [makeSession({ totalFocusMs: 10 * 60_000, createdAt: 0 })];
    expect(groupByRitual(sessions)).toEqual([{ key: null, totalFocusMs: 10 * 60_000, sessionCount: 1 }]);
    expect(groupByTask(sessions)).toEqual([{ key: null, totalFocusMs: 10 * 60_000, sessionCount: 1 }]);
  });
});

describe('favoriteRitualId', () => {
  test('returns the ritual with the most total focus time', () => {
    const sessions = [
      makeSession({ totalFocusMs: 10 * 60_000, createdAt: 0, ritualId: 'r1' }),
      makeSession({ totalFocusMs: 40 * 60_000, createdAt: 0, ritualId: 'r2' }),
    ];
    expect(favoriteRitualId(sessions)).toBe('r2');
  });

  test('ignores the null (no-ritual) bucket even if it has the most time', () => {
    const sessions = [
      makeSession({ totalFocusMs: 999 * 60_000, createdAt: 0, ritualId: null }),
      makeSession({ totalFocusMs: 5 * 60_000, createdAt: 0, ritualId: 'r1' }),
    ];
    expect(favoriteRitualId(sessions)).toBe('r1');
  });

  test('returns null when no session is ritual-linked', () => {
    expect(favoriteRitualId([makeSession({ totalFocusMs: 10, createdAt: 0 })])).toBeNull();
  });

  test('returns null for an empty session list', () => {
    expect(favoriteRitualId([])).toBeNull();
  });
});

describe('bestFocusSegment', () => {
  test('picks the time-of-day segment with the most focus time', () => {
    const sessions = [
      makeSession({ totalFocusMs: 60 * 60_000, createdAt: localTime(2024, 0, 1, 9, 0) }), // morning
      makeSession({ totalFocusMs: 10 * 60_000, createdAt: localTime(2024, 0, 2, 22, 0) }), // night
    ];
    expect(bestFocusSegment(sessions)).toBe('morning');
  });

  test('returns null when there is no focus time at all', () => {
    expect(bestFocusSegment([])).toBeNull();
  });
});

describe('weeklyRhythm', () => {
  test('always returns 7 entries starting from weekStartsOn', () => {
    const sunday = weeklyRhythm([], 0);
    expect(sunday.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);

    const monday = weeklyRhythm([], 1);
    expect(monday.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  test('sums focus time per day of week across the whole input', () => {
    // Jan 1 2024 is a Monday, Jan 8 2024 is also a Monday.
    const sessions = [
      makeSession({ totalFocusMs: 20 * 60_000, createdAt: localTime(2024, 0, 1) }),
      makeSession({ totalFocusMs: 15 * 60_000, createdAt: localTime(2024, 0, 8) }),
    ];
    const rhythm = weeklyRhythm(sessions, 1);
    const monday = rhythm.find((d) => d.dayOfWeek === 1);
    expect(monday?.totalFocusMs).toBe(35 * 60_000);
  });
});

describe('formatFocusDuration', () => {
  test('sub-minute durations read as "< 1m", never "0m"', () => {
    expect(formatFocusDuration(30_000)).toBe('< 1m');
    expect(formatFocusDuration(0)).toBe('< 1m');
  });

  test('minutes only', () => {
    expect(formatFocusDuration(45 * 60_000)).toBe('45m');
  });

  test('whole hours only', () => {
    expect(formatFocusDuration(2 * 60 * 60_000)).toBe('2h');
  });

  test('hours and minutes', () => {
    expect(formatFocusDuration(2 * 60 * 60_000 + 15 * 60_000)).toBe('2h 15m');
  });
});
