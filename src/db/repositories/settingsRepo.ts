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
