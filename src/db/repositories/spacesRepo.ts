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
}

export interface BundledSpaceInput {
  id: string;
  name: string;
  bundledSceneId: string;
  createdAt: number;
}

/** INSERT OR IGNORE keyed by the scene's own stable id — safe to call every app start. */
export async function insertBundledSpaceIfMissing(db: Database, input: BundledSpaceInput): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO spaces (id, name, kind, bundled_scene_id, created_at, is_archived)
     VALUES (?, ?, 'bundled', ?, ?, 0)`,
    [input.id, input.name, input.bundledSceneId, input.createdAt]
  );
}

export async function listSpaces(db: Database): Promise<SpaceRow[]> {
  return db.getAllAsync<SpaceRow>('SELECT * FROM spaces ORDER BY created_at', []);
}
