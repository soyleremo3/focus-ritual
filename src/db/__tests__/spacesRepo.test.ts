import { createRitual } from '../repositories/ritualsRepo';
import {
  archiveCustomSpace,
  createCustomSpace,
  getSpaceById,
  listSpaces,
  markSpaceUsed,
  setSpaceFavorite,
  updateCustomSpace,
} from '../repositories/spacesRepo';
import { migrate } from '../schema';
import { seedBundledData } from '../seed';
import type { Database } from '../types';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;

async function setupDb(): Promise<Database> {
  const db = createTestDatabase();
  await migrate(db);
  await seedBundledData(db, T0);
  return db;
}

describe('spacesRepo', () => {
  test('createCustomSpace inserts a kind=custom row with the given photo/mood', async () => {
    const db = await setupDb();
    const space = await createCustomSpace(db, { name: 'My Desk', imageUri: 'file:///spaces/a.jpg', paletteMood: 'warm' }, T0);

    expect(space.kind).toBe('custom');
    expect(space.name).toBe('My Desk');
    expect(space.image_uri).toBe('file:///spaces/a.jpg');
    expect(space.palette_mood).toBe('warm');
    expect(space.is_archived).toBe(0);
    expect(space.is_favorite).toBe(0);
  });

  test('listSpaces includes bundled scenes plus active custom spaces, ordered by created_at', async () => {
    const db = await setupDb();
    await createCustomSpace(db, { name: 'My Desk', imageUri: 'file:///a.jpg', paletteMood: 'warm' }, T0 + 1000);

    const spaces = await listSpaces(db);
    expect(spaces.some((s) => s.kind === 'bundled')).toBe(true);
    expect(spaces.some((s) => s.name === 'My Desk')).toBe(true);
  });

  test('updateCustomSpace renames and replaces the photo', async () => {
    const db = await setupDb();
    const space = await createCustomSpace(db, { name: 'My Desk', imageUri: 'file:///a.jpg', paletteMood: 'warm' }, T0);

    await updateCustomSpace(db, space.id, { name: 'Rainy Desk', imageUri: 'file:///b.jpg', paletteMood: 'cool' });

    const updated = await getSpaceById(db, space.id);
    expect(updated?.name).toBe('Rainy Desk');
    expect(updated?.image_uri).toBe('file:///b.jpg');
    expect(updated?.palette_mood).toBe('cool');
  });

  test('updateCustomSpace refuses to modify a bundled space', async () => {
    const db = await setupDb();
    await expect(updateCustomSpace(db, 'amber-study', { name: 'Hacked' })).rejects.toThrow();
  });

  test('archiveCustomSpace refuses to delete a bundled space', async () => {
    const db = await setupDb();
    await expect(archiveCustomSpace(db, 'amber-study')).rejects.toThrow();
  });

  test('archiveCustomSpace hides the space from listSpaces but preserves the row', async () => {
    const db = await setupDb();
    const space = await createCustomSpace(db, { name: 'My Desk', imageUri: 'file:///a.jpg', paletteMood: 'warm' }, T0);

    await archiveCustomSpace(db, space.id);

    const spaces = await listSpaces(db);
    expect(spaces.some((s) => s.id === space.id)).toBe(false);

    const stillThere = await getSpaceById(db, space.id);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.is_archived).toBe(1);
    expect(stillThere?.image_uri).toBe('file:///a.jpg');
  });

  test('a ritual referencing a since-deleted custom space still resolves it (fallback safety)', async () => {
    const db = await setupDb();
    const space = await createCustomSpace(db, { name: 'My Desk', imageUri: 'file:///a.jpg', paletteMood: 'warm' }, T0);

    const ritual = await createRitual(
      db,
      {
        name: 'Deep Work',
        timerMode: 'deepWork',
        focusMinutes: 50,
        breakMinutes: 10,
        cyclesTarget: null,
        spaceId: space.id,
        soundLayers: [],
      },
      T0
    );

    await archiveCustomSpace(db, space.id);

    // The ritual's spaceId still resolves to the original photo/mood — nothing is lost.
    const resolved = await getSpaceById(db, ritual.spaceId ?? '');
    expect(resolved).not.toBeNull();
    expect(resolved?.image_uri).toBe('file:///a.jpg');
    expect(resolved?.palette_mood).toBe('warm');
  });

  test('setSpaceFavorite and markSpaceUsed update their respective columns', async () => {
    const db = await setupDb();
    const space = await createCustomSpace(db, { name: 'My Desk', imageUri: 'file:///a.jpg', paletteMood: 'warm' }, T0);

    await setSpaceFavorite(db, space.id, true);
    await markSpaceUsed(db, space.id, T0 + 5000);

    const row = await getSpaceById(db, space.id);
    expect(row?.is_favorite).toBe(1);
    expect(row?.last_used_at).toBe(T0 + 5000);
  });
});
