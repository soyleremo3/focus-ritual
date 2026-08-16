import { generateId } from '@/domain/id';

import type { Database } from '../types';

export interface SpaceRow {
  id: string;
  name: string;
  kind: 'bundled' | 'custom';
  bundled_scene_id: string | null;
  image_uri: string | null;
  palette_mood: string | null;
  created_at: number;
  is_archived: number;
  is_favorite: number;
  last_used_at: number | null;
}

export interface BundledSpaceInput {
  id: string;
  name: string;
  bundledSceneId: string;
  createdAt: number;
}

export interface CustomSpaceDraft {
  name: string;
  imageUri: string;
  paletteMood: string;
}

export interface CustomSpaceUpdate {
  name?: string;
  imageUri?: string;
  paletteMood?: string;
}

/** INSERT OR IGNORE keyed by the scene's own stable id — safe to call every app start. */
export async function insertBundledSpaceIfMissing(db: Database, input: BundledSpaceInput): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO spaces (id, name, kind, bundled_scene_id, created_at, is_archived)
     VALUES (?, ?, 'bundled', ?, ?, 0)`,
    [input.id, input.name, input.bundledSceneId, input.createdAt]
  );
}

/** Active (non-archived) spaces only — what the gallery and ritual editor show. */
export async function listSpaces(db: Database): Promise<SpaceRow[]> {
  return db.getAllAsync<SpaceRow>('SELECT * FROM spaces WHERE is_archived = 0 ORDER BY created_at', []);
}

/**
 * Returns a space regardless of archived status — a ritual referencing a since-deleted
 * custom space must still be able to resolve its backdrop/palette.
 */
export async function getSpaceById(db: Database, id: string): Promise<SpaceRow | null> {
  return db.getFirstAsync<SpaceRow>('SELECT * FROM spaces WHERE id = ?', [id]);
}

export async function createCustomSpace(db: Database, draft: CustomSpaceDraft, now: number = Date.now()): Promise<SpaceRow> {
  const id = generateId();
  await db.runAsync(
    `INSERT INTO spaces (id, name, kind, image_uri, palette_mood, created_at, is_archived)
     VALUES (?, ?, 'custom', ?, ?, ?, 0)`,
    [id, draft.name, draft.imageUri, draft.paletteMood, now]
  );
  const row = await getSpaceById(db, id);
  if (!row) throw new Error('[spacesRepo] failed to read back created space');
  return row;
}

/** Rename/re-tag/replace-photo for a custom space. Bundled spaces are immutable — throws if kind !== 'custom'. */
export async function updateCustomSpace(db: Database, id: string, patch: CustomSpaceUpdate): Promise<void> {
  const row = await getSpaceById(db, id);
  if (!row || row.kind !== 'custom') {
    throw new Error(`[spacesRepo] space ${id} is not an editable custom space`);
  }
  await db.runAsync(
    `UPDATE spaces SET name = ?, image_uri = ?, palette_mood = ? WHERE id = ?`,
    [patch.name ?? row.name, patch.imageUri ?? row.image_uri, patch.paletteMood ?? row.palette_mood, id]
  );
}

/**
 * Soft delete only — the row (and its image_uri/palette_mood) stays intact so any ritual
 * still referencing this space keeps resolving its backdrop exactly as before. It just
 * disappears from the gallery and future space pickers.
 */
export async function archiveCustomSpace(db: Database, id: string): Promise<void> {
  const row = await getSpaceById(db, id);
  if (!row || row.kind !== 'custom') {
    throw new Error(`[spacesRepo] space ${id} is not a deletable custom space`);
  }
  await db.runAsync('UPDATE spaces SET is_archived = 1 WHERE id = ?', [id]);
}

export async function setSpaceFavorite(db: Database, id: string, isFavorite: boolean): Promise<void> {
  await db.runAsync('UPDATE spaces SET is_favorite = ? WHERE id = ?', [isFavorite ? 1 : 0, id]);
}

export async function markSpaceUsed(db: Database, id: string, now: number = Date.now()): Promise<void> {
  await db.runAsync('UPDATE spaces SET last_used_at = ? WHERE id = ?', [now, id]);
}
