import { generateId } from '@/domain/id';
import { duplicateRitualName } from '@/domain/ritual/ritual';
import type { Ritual, RitualSoundLayer } from '@/domain/ritual/types';
import type { TimerMode } from '@/domain/timer/types';

import type { Database } from '../types';

interface RitualRow {
  id: string;
  name: string;
  timer_mode: string;
  focus_minutes: number | null;
  break_minutes: number | null;
  cycles_target: number | null;
  space_id: string | null;
  is_favorite: number;
  last_used_at: number | null;
  created_at: number;
  is_archived: number;
}

interface RitualSoundLayerRow {
  ritual_id: string;
  sound_id: string;
  volume: number;
  position: number;
}

export interface RitualDraft {
  name: string;
  timerMode: TimerMode;
  focusMinutes: number | null;
  breakMinutes: number | null;
  cyclesTarget: number | null;
  spaceId: string | null;
  soundLayers: RitualSoundLayer[];
}

function rowToRitual(row: RitualRow, layerRows: RitualSoundLayerRow[]): Ritual {
  return {
    id: row.id,
    name: row.name,
    timerMode: row.timer_mode as TimerMode,
    focusMinutes: row.focus_minutes,
    breakMinutes: row.break_minutes,
    cyclesTarget: row.cycles_target,
    spaceId: row.space_id,
    soundLayers: layerRows
      .filter((l) => l.ritual_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((l) => ({ soundId: l.sound_id, volume: l.volume, position: l.position })),
    isFavorite: row.is_favorite === 1,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    isArchived: row.is_archived === 1,
  };
}

async function replaceSoundLayers(db: Database, ritualId: string, layers: RitualSoundLayer[]): Promise<void> {
  await db.runAsync('DELETE FROM ritual_sound_layers WHERE ritual_id = ?', [ritualId]);
  for (const layer of layers) {
    await db.runAsync('INSERT INTO ritual_sound_layers (ritual_id, sound_id, volume, position) VALUES (?, ?, ?, ?)', [
      ritualId,
      layer.soundId,
      layer.volume,
      layer.position,
    ]);
  }
}

/** Active (non-archived) rituals, unsorted — callers apply domain/ritual's sortRituals(). */
export async function listRituals(db: Database): Promise<Ritual[]> {
  const rows = await db.getAllAsync<RitualRow>('SELECT * FROM rituals WHERE is_archived = 0', []);
  if (rows.length === 0) return [];

  const placeholders = rows.map(() => '?').join(', ');
  const layerRows = await db.getAllAsync<RitualSoundLayerRow>(
    `SELECT * FROM ritual_sound_layers WHERE ritual_id IN (${placeholders})`,
    rows.map((r) => r.id)
  );
  return rows.map((row) => rowToRitual(row, layerRows));
}

export async function getRitualById(db: Database, id: string): Promise<Ritual | null> {
  const row = await db.getFirstAsync<RitualRow>('SELECT * FROM rituals WHERE id = ?', [id]);
  if (!row) return null;
  const layerRows = await db.getAllAsync<RitualSoundLayerRow>('SELECT * FROM ritual_sound_layers WHERE ritual_id = ?', [
    id,
  ]);
  return rowToRitual(row, layerRows);
}

export async function countRituals(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM rituals WHERE is_archived = 0', []);
  return row?.count ?? 0;
}

/**
 * Includes archived rituals — distinguishes "this user has never had a ritual" from
 * "this user currently has zero active rituals" (e.g. right after deleting all of them).
 * seedExampleRitualsIfEmpty needs the former, not the latter — otherwise deleting every
 * example ritual would resurrect them on the next app start.
 */
export async function countAllRituals(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM rituals', []);
  return row?.count ?? 0;
}

export async function createRitual(db: Database, draft: RitualDraft, now: number): Promise<Ritual> {
  const id = generateId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO rituals (
        id, name, timer_mode, focus_minutes, break_minutes, cycles_target, space_id,
        is_favorite, last_used_at, created_at, is_archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 0)`,
      [id, draft.name, draft.timerMode, draft.focusMinutes, draft.breakMinutes, draft.cyclesTarget, draft.spaceId, now]
    );
    await replaceSoundLayers(db, id, draft.soundLayers);
  });

  const created = await getRitualById(db, id);
  if (!created) throw new Error(`Failed to read back newly created ritual ${id}`);
  return created;
}

export async function updateRitual(db: Database, id: string, draft: RitualDraft): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE rituals SET
        name = ?, timer_mode = ?, focus_minutes = ?, break_minutes = ?, cycles_target = ?, space_id = ?
       WHERE id = ?`,
      [draft.name, draft.timerMode, draft.focusMinutes, draft.breakMinutes, draft.cyclesTarget, draft.spaceId, id]
    );
    await replaceSoundLayers(db, id, draft.soundLayers);
  });
}

/** Copies name (with a collision-avoiding "(Copy)" suffix), mode, durations, space, and sound layers. */
export async function duplicateRitual(db: Database, id: string, now: number): Promise<Ritual> {
  const original = await getRitualById(db, id);
  if (!original) throw new Error(`Ritual ${id} not found`);

  const existingNames = (await listRituals(db)).map((r) => r.name);
  const name = duplicateRitualName(original.name, existingNames);

  return createRitual(
    db,
    {
      name,
      timerMode: original.timerMode,
      focusMinutes: original.focusMinutes,
      breakMinutes: original.breakMinutes,
      cyclesTarget: original.cyclesTarget,
      spaceId: original.spaceId,
      soundLayers: original.soundLayers,
    },
    now
  );
}

/** Soft delete — archives rather than removing the row, so a session that referenced it stays valid. */
export async function deleteRitual(db: Database, id: string): Promise<void> {
  await db.runAsync('UPDATE rituals SET is_archived = 1 WHERE id = ?', [id]);
}

export async function setRitualFavorite(db: Database, id: string, isFavorite: boolean): Promise<void> {
  await db.runAsync('UPDATE rituals SET is_favorite = ? WHERE id = ?', [isFavorite ? 1 : 0, id]);
}

export async function markRitualUsed(db: Database, id: string, now: number): Promise<void> {
  await db.runAsync('UPDATE rituals SET last_used_at = ? WHERE id = ?', [now, id]);
}
