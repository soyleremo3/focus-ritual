import type { TimerMode, TimerPhase, TimerSession, TimerStatus } from '@/domain/timer/types';

import type { Database } from '../types';

export interface SessionRow {
  id: string;
  ritual_id: string | null;
  mode: string;
  phase: string;
  status: string;
  started_at: number | null;
  accumulated_ms: number;
  focus_minutes: number | null;
  break_minutes: number | null;
  cycles_target: number | null;
  cycles_completed: number;
  created_at: number;
  updated_at: number;
}

function rowToSession(row: SessionRow): TimerSession {
  return {
    id: row.id,
    ritualId: row.ritual_id,
    mode: row.mode as TimerMode,
    phase: row.phase as TimerPhase,
    status: row.status as TimerStatus,
    startedAt: row.started_at,
    accumulatedMs: row.accumulated_ms,
    focusMinutes: row.focus_minutes,
    breakMinutes: row.break_minutes,
    cyclesTarget: row.cycles_target,
    cyclesCompleted: row.cycles_completed,
  };
}

/** A session is "active" — recoverable on cold start — until it completes or is cancelled. */
const ACTIVE_STATUSES: TimerSession['status'][] = ['running', 'paused', 'awaiting-start'];

/**
 * The most recently updated active session, if any. Used at app start to recover a
 * running/paused session across a cold start / app kill — the caller is expected to run
 * it through domain/timer/timerEngine's reconcile() before trusting it as current.
 */
export async function getActiveSession(db: Database): Promise<TimerSession | null> {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE status IN (?, ?, ?) ORDER BY updated_at DESC LIMIT 1`,
    ACTIVE_STATUSES
  );
  return row ? rowToSession(row) : null;
}

export async function getSessionById(db: Database, id: string): Promise<TimerSession | null> {
  const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
  return row ? rowToSession(row) : null;
}

/**
 * Insert-or-update in a single atomic statement (ON CONFLICT DO UPDATE), keyed by the
 * session's own id. `created_at` is only ever set on the initial insert — the UPDATE
 * branch doesn't touch it, so it stays immutable across every subsequent call.
 */
export async function upsertSession(db: Database, session: TimerSession, now: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO sessions (
      id, ritual_id, mode, phase, status, started_at, accumulated_ms,
      focus_minutes, break_minutes, cycles_target, cycles_completed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      ritual_id = excluded.ritual_id,
      mode = excluded.mode,
      phase = excluded.phase,
      status = excluded.status,
      started_at = excluded.started_at,
      accumulated_ms = excluded.accumulated_ms,
      focus_minutes = excluded.focus_minutes,
      break_minutes = excluded.break_minutes,
      cycles_target = excluded.cycles_target,
      cycles_completed = excluded.cycles_completed,
      updated_at = excluded.updated_at`,
    [
      session.id,
      session.ritualId,
      session.mode,
      session.phase,
      session.status,
      session.startedAt,
      session.accumulatedMs,
      session.focusMinutes,
      session.breakMinutes,
      session.cyclesTarget,
      session.cyclesCompleted,
      now,
      now,
    ]
  );
}
