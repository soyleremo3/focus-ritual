import { soundLibrary } from '@/lib/audio/soundLibrary';
import { sceneList } from '@/theme/scenePalettes';

import { insertBundledSpaceIfMissing } from './repositories/spacesRepo';
import { insertBundledSoundIfMissing } from './repositories/soundsRepo';
import type { Database } from './types';

/**
 * Idempotent — every row is INSERT OR IGNORE keyed by the bundled scene/sound's own
 * stable id, so running this on every app start (via getDatabase()) never duplicates
 * rows and never overwrites a row a later phase's UI might have modified.
 */
export async function seedBundledData(db: Database, now: number = Date.now()): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const scene of sceneList) {
      await insertBundledSpaceIfMissing(db, {
        id: scene.id,
        name: scene.name,
        bundledSceneId: scene.id,
        createdAt: now,
      });
    }

    for (const sound of soundLibrary) {
      await insertBundledSoundIfMissing(db, { id: sound.id, label: sound.label });
    }
  });
}
