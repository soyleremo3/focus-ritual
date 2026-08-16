import type { Database } from './types';

export interface Migration {
  version: number;
  statements: string[];
}

/**
 * Ordered, additive migration steps rather than a single-shot schema block — this
 * database will grow across the phase roadmap (Rituals in Phase 3, custom wallpapers in
 * Phase 4, ...), and each phase should be able to add a migration without touching this
 * one. Never edit a migration once it has shipped; add a new one instead.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE spaces (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'bundled',
        bundled_scene_id TEXT,
        image_uri TEXT,
        palette_mood TEXT,
        created_at INTEGER NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE sounds (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT NOT NULL,
        is_bundled INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE rituals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        timer_mode TEXT NOT NULL,
        focus_minutes INTEGER,
        break_minutes INTEGER,
        cycles_target INTEGER,
        space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL,
        is_archived INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE ritual_sound_layers (
        ritual_id TEXT NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
        sound_id TEXT NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
        volume REAL NOT NULL DEFAULT 0.6,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ritual_id, sound_id)
      )`,
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        is_done INTEGER NOT NULL DEFAULT 0,
        ritual_id TEXT REFERENCES rituals(id) ON DELETE SET NULL,
        linked_session_count INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      )`,
      `CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        ritual_id TEXT REFERENCES rituals(id) ON DELETE SET NULL,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        mode TEXT NOT NULL,
        phase TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER,
        accumulated_ms INTEGER NOT NULL DEFAULT 0,
        focus_minutes INTEGER,
        break_minutes INTEGER,
        cycles_target INTEGER,
        cycles_completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        theme_mode TEXT NOT NULL DEFAULT 'system',
        haptics_enabled INTEGER NOT NULL DEFAULT 1,
        notifications_enabled INTEGER NOT NULL DEFAULT 1,
        default_ritual_id TEXT REFERENCES rituals(id) ON DELETE SET NULL,
        week_starts_on INTEGER NOT NULL DEFAULT 0,
        onboarding_complete INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX idx_sessions_status ON sessions (status)`,
      `CREATE INDEX idx_sessions_started_at ON sessions (started_at)`,
      `CREATE INDEX idx_tasks_sort_order ON tasks (sort_order)`,
      `CREATE INDEX idx_rituals_archived ON rituals (is_archived)`,
    ],
  },
  {
    version: 2,
    statements: [
      // Focus Spaces gallery (Phase 4): favorite/last-used ordering for spaces, matching
      // the pattern already established for rituals.
      `ALTER TABLE spaces ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE spaces ADD COLUMN last_used_at INTEGER`,
      // The user's standalone (non-ritual) Focus Space pick, so it persists across app
      // restarts independently of any ritual.
      `ALTER TABLE settings ADD COLUMN active_space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL`,
    ],
  },
  {
    version: 3,
    statements: [
      // Sound mixer polish (Phase 5): the user's standalone ambient mix and master volume,
      // so they persist across app restarts independently of any ritual — same pattern as
      // active_space_id above. active_sound_mix is a JSON-encoded [{soundId, volume}, ...].
      `ALTER TABLE settings ADD COLUMN active_sound_mix TEXT`,
      `ALTER TABLE settings ADD COLUMN master_volume REAL NOT NULL DEFAULT 1`,
    ],
  },
  {
    version: 4,
    statements: [
      // Today Tasks & History (Phase 6): total focus-phase ms banked from every closed-out
      // phase segment of a session — see domain/timer/timerEngine.ts's bankedFocusMs.
      // Without this, a multi-cycle session's total focus time couldn't be reconstructed
      // from a persisted row, since accumulated_ms only ever reflects the current phase.
      `ALTER TABLE sessions ADD COLUMN banked_focus_ms INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 5,
    statements: [
      // Notifications & Settings (Phase 7). default_focus_minutes/default_break_minutes
      // back only Custom mode's standalone (non-ritual) start — every other mode's numbers
      // are what define that mode, so they stay in MODE_DEFAULTS, not user-configurable
      // here. auto_start_breaks/auto_start_next_focus feed domain/timer/timerEngine's
      // autoStarts(); their defaults (1/0) match what was previously hardcoded, so an
      // un-migrated user's behavior doesn't change. pause_sound_with_timer controls
      // whether ambient sound pauses/resumes alongside the timer's own pause/resume.
      `ALTER TABLE settings ADD COLUMN default_focus_minutes INTEGER NOT NULL DEFAULT 25`,
      `ALTER TABLE settings ADD COLUMN default_break_minutes INTEGER NOT NULL DEFAULT 5`,
      `ALTER TABLE settings ADD COLUMN auto_start_breaks INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE settings ADD COLUMN auto_start_next_focus INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE settings ADD COLUMN pause_sound_with_timer INTEGER NOT NULL DEFAULT 1`,
    ],
  },
];

interface UserVersionRow {
  user_version: number;
}

export async function getSchemaVersion(db: Database): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/**
 * Applies every migration newer than the database's current PRAGMA user_version, in
 * order, each inside its own transaction. Safe to call on every app start — if there's
 * nothing pending, this is a no-op after one PRAGMA read.
 */
export async function migrate(db: Database): Promise<void> {
  const currentVersion = await getSchemaVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.statements.join(';\n'));
    });
    // PRAGMA doesn't accept bound parameters; the version is an internal integer we
    // control, not user input, so string interpolation here is safe.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
