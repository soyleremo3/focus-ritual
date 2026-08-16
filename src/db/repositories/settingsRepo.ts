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
  active_sound_mix: string | null;
  master_volume: number;
  default_focus_minutes: number;
  default_break_minutes: number;
  auto_start_breaks: number;
  auto_start_next_focus: number;
  pause_sound_with_timer: number;
}

export type ThemeModePreference = 'system' | 'light' | 'dark';

const THEME_MODES: ThemeModePreference[] = ['system', 'light', 'dark'];

function toThemeMode(value: string): ThemeModePreference {
  return (THEME_MODES as string[]).includes(value) ? (value as ThemeModePreference) : 'system';
}

/**
 * The app-level settings actually surfaced in Settings (Phase 7). `default_ritual_id` and
 * `onboarding_complete` stay in SettingsRow/the schema but out of this type deliberately —
 * neither has a feature to attach to (no "start default ritual" quick action, no onboarding
 * flow exists), so exposing them here would be UI for a feature that doesn't exist yet.
 */
export interface AppSettings {
  themeMode: ThemeModePreference;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  weekStartsOn: 0 | 1;
  defaultFocusMinutes: number;
  defaultBreakMinutes: number;
  autoStartBreaks: boolean;
  autoStartNextFocus: boolean;
  pauseSoundWithTimer: boolean;
}

function rowToSettings(row: SettingsRow): AppSettings {
  return {
    themeMode: toThemeMode(row.theme_mode),
    hapticsEnabled: row.haptics_enabled === 1,
    notificationsEnabled: row.notifications_enabled === 1,
    weekStartsOn: row.week_starts_on === 1 ? 1 : 0,
    defaultFocusMinutes: row.default_focus_minutes,
    defaultBreakMinutes: row.default_break_minutes,
    autoStartBreaks: row.auto_start_breaks === 1,
    autoStartNextFocus: row.auto_start_next_focus === 1,
    pauseSoundWithTimer: row.pause_sound_with_timer === 1,
  };
}

const SETTINGS_COLUMNS: Record<keyof AppSettings, string> = {
  themeMode: 'theme_mode',
  hapticsEnabled: 'haptics_enabled',
  notificationsEnabled: 'notifications_enabled',
  weekStartsOn: 'week_starts_on',
  defaultFocusMinutes: 'default_focus_minutes',
  defaultBreakMinutes: 'default_break_minutes',
  autoStartBreaks: 'auto_start_breaks',
  autoStartNextFocus: 'auto_start_next_focus',
  pauseSoundWithTimer: 'pause_sound_with_timer',
};

function toColumnValue(value: AppSettings[keyof AppSettings]): string | number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export interface SoundMixLayer {
  soundId: string;
  volume: number;
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

/** Parse failures (corrupt/foreign JSON) fall back to an empty mix rather than throwing. */
export async function getActiveSoundMix(db: Database): Promise<SoundMixLayer[]> {
  const row = await getOrCreateSettings(db);
  if (!row.active_sound_mix) return [];
  try {
    const parsed: unknown = JSON.parse(row.active_sound_mix);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is SoundMixLayer => typeof l === 'object' && l !== null && typeof l.soundId === 'string' && typeof l.volume === 'number'
    );
  } catch {
    return [];
  }
}

export async function setActiveSoundMix(db: Database, mix: SoundMixLayer[]): Promise<void> {
  await getOrCreateSettings(db);
  await db.runAsync('UPDATE settings SET active_sound_mix = ? WHERE id = 1', [JSON.stringify(mix)]);
}

export async function getMasterVolume(db: Database): Promise<number> {
  const row = await getOrCreateSettings(db);
  return row.master_volume;
}

export async function setMasterVolume(db: Database, volume: number): Promise<void> {
  await getOrCreateSettings(db);
  await db.runAsync('UPDATE settings SET master_volume = ? WHERE id = 1', [volume]);
}

export async function getSettings(db: Database): Promise<AppSettings> {
  return rowToSettings(await getOrCreateSettings(db));
}

/** Persists only the fields present in `patch`, then returns the full settings row read back. */
export async function updateSettings(db: Database, patch: Partial<AppSettings>): Promise<AppSettings> {
  await getOrCreateSettings(db);
  const entries = Object.entries(patch) as [keyof AppSettings, AppSettings[keyof AppSettings]][];
  if (entries.length > 0) {
    const setClause = entries.map(([key]) => `${SETTINGS_COLUMNS[key]} = ?`).join(', ');
    const values = entries.map(([, value]) => toColumnValue(value));
    await db.runAsync(`UPDATE settings SET ${setClause} WHERE id = 1`, values);
  }
  return getSettings(db);
}
