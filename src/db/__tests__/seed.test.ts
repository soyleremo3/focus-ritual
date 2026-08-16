import { listSounds } from '../repositories/soundsRepo';
import { getSpaceById, listSpaces } from '../repositories/spacesRepo';
import { seedBundledData } from '../seed';
import { migrate } from '../schema';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;

describe('seedBundledData', () => {
  it('inserts all 3 bundled scenes as spaces and all 7 bundled sounds', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    const spaces = await listSpaces(db);
    const sounds = await listSounds(db);

    expect(spaces.map((s) => s.id).sort()).toEqual(['amber-study', 'midnight-forest', 'rain-window']);
    expect(spaces.every((s) => s.kind === 'bundled')).toBe(true);
    expect(sounds.map((s) => s.id).sort()).toEqual([
      'brown-noise',
      'fireplace',
      'ocean-waves',
      'pink-noise',
      'rain',
      'white-noise',
      'wind',
    ]);
  });

  it('is idempotent — running it many times never duplicates rows', async () => {
    const db = createTestDatabase();
    await migrate(db);

    await seedBundledData(db, T0);
    await seedBundledData(db, T0 + 1);
    await seedBundledData(db, T0 + 2);

    const spaces = await listSpaces(db);
    const sounds = await listSounds(db);

    expect(spaces).toHaveLength(3);
    expect(sounds).toHaveLength(7);
    // Re-running with a different `now` must not touch the original created_at.
    expect(spaces.every((s) => s.createdAt === T0)).toBe(true);
  });

  it('does not clobber a row already modified, even though the app never lets a user edit a bundled space', async () => {
    // Bundled spaces are immutable through the app's own repository functions (see
    // spacesRepo's updateCustomSpace/archiveCustomSpace guards), but seedBundledData's
    // INSERT OR IGNORE must still be safe regardless of how a row got modified.
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    await db.runAsync("UPDATE spaces SET name = 'My Renamed Study', is_archived = 1 WHERE id = 'amber-study'", []);
    await seedBundledData(db, T0 + 1000);

    // listSpaces is active-only (matches listRituals) — the now-archived row correctly
    // drops out of it. Read it back directly to confirm re-seeding didn't touch it.
    const amberStudy = await getSpaceById(db, 'amber-study');
    expect(amberStudy?.name).toBe('My Renamed Study');
    expect(amberStudy?.isArchived).toBe(true);
  });
});
