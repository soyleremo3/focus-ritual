import { listSounds } from '../repositories/soundsRepo';
import { listSpaces } from '../repositories/spacesRepo';
import { seedBundledData } from '../seed';
import { migrate } from '../schema';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;

describe('seedBundledData', () => {
  it('inserts all 3 bundled scenes as spaces and all 3 bundled sounds', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    const spaces = await listSpaces(db);
    const sounds = await listSounds(db);

    expect(spaces.map((s) => s.id).sort()).toEqual(['amber-study', 'midnight-forest', 'rain-window']);
    expect(spaces.every((s) => s.kind === 'bundled')).toBe(true);
    expect(sounds.map((s) => s.id).sort()).toEqual(['brown-noise', 'rain', 'white-noise']);
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
    expect(sounds).toHaveLength(3);
    // Re-running with a different `now` must not touch the original created_at.
    expect(spaces.every((s) => s.created_at === T0)).toBe(true);
  });

  it('does not clobber a row a later phase has already modified', async () => {
    // Once Phase 4 lets a user archive/rename a bundled space, re-seeding on the next
    // app start must not silently reset it back to defaults.
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    await db.runAsync("UPDATE spaces SET name = 'My Renamed Study', is_archived = 1 WHERE id = 'amber-study'", []);
    await seedBundledData(db, T0 + 1000);

    const spaces = await listSpaces(db);
    const amberStudy = spaces.find((s) => s.id === 'amber-study');
    expect(amberStudy?.name).toBe('My Renamed Study');
    expect(amberStudy?.is_archived).toBe(1);
  });
});
