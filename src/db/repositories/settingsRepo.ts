import type { Database } from '../types';

export interface SettingsRow {
  id: number;
  theme_mode: string;
  haptics_enabled: number;
  notifications_enabled: number;
  default_ritual_id: string | null;
  week_starts_on: number;
  onboarding_complete: number;
  active_space_id: string | null;
}

/** The settings table is a single row (id=1, CHECK-constrained). Creates it on first touch. */
export async function getOrCreateSettings(db: Database): Promise<SettingsRow> {
  await db.runAsync('INSERT OR IGNORE INTO settings (id) VALUES (1)', []);
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1', []);
  if (!row) throw new Error('[settingsRepo] failed to read back settings row');
  return row;
}

export async function getActiveSpaceId(db: Database): Promise<string | null> {
  const row = await getOrCreateSettings(db);
  return row.active_space_id;
}

export async function setActiveSpaceId(db: Database, spaceId: string | null): Promise<void> {
  await getOrCreateSettings(db);
  await db.runAsync('UPDATE settings SET active_space_id = ? WHERE id = 1', [spaceId]);
}
