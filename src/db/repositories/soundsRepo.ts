import type { Database } from '../types';

export interface SoundRow {
  id: string;
  label: string;
  is_bundled: number;
}

export interface BundledSoundInput {
  id: string;
  label: string;
}

/** INSERT OR IGNORE keyed by the sound's own stable id — safe to call every app start. */
export async function insertBundledSoundIfMissing(db: Database, input: BundledSoundInput): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO sounds (id, label, is_bundled) VALUES (?, ?, 1)', [
    input.id,
    input.label,
  ]);
}

export async function listSounds(db: Database): Promise<SoundRow[]> {
  return db.getAllAsync<SoundRow>('SELECT * FROM sounds ORDER BY id', []);
}
