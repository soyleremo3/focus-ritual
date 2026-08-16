import {
  countRituals,
  createRitual,
  deleteRitual,
  duplicateRitual,
  getRitualById,
  listRituals,
  markRitualUsed,
  setRitualFavorite,
  updateRitual,
  type RitualDraft,
} from '../repositories/ritualsRepo';
import { migrate } from '../schema';
import { seedBundledData } from '../seed';
import type { Database } from '../types';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;

/** ritual_sound_layers.sound_id has a foreign key into sounds — seed it first, exactly like the real app does. */
async function setupDb(): Promise<Database> {
  const db = createTestDatabase();
  await migrate(db);
  await seedBundledData(db, T0);
  return db;
}

const POMODORO_DRAFT: RitualDraft = {
  name: 'Morning Pages',
  timerMode: 'pomodoro',
  focusMinutes: 25,
  breakMinutes: 5,
  cyclesTarget: 4,
  spaceId: null,
  soundLayers: [
    { soundId: 'rain', volume: 0.5, position: 0 },
    { soundId: 'white-noise', volume: 0.3, position: 1 },
  ],
};

describe('ritualsRepo', () => {
  it('creates a ritual and reads it back with its sound layers', async () => {
    const db = await setupDb();

    const created = await createRitual(db, POMODORO_DRAFT, T0);
    expect(created.name).toBe('Morning Pages');
    expect(created.isFavorite).toBe(false);
    expect(created.lastUsedAt).toBeNull();
    expect(created.isArchived).toBe(false);
    expect(created.soundLayers).toEqual([
      { soundId: 'rain', volume: 0.5, position: 0 },
      { soundId: 'white-noise', volume: 0.3, position: 1 },
    ]);

    const fetched = await getRitualById(db, created.id);
    expect(fetched).toEqual(created);
  });

  it('listRituals only returns non-archived rituals', async () => {
    const db = await setupDb();

    const keep = await createRitual(db, { ...POMODORO_DRAFT, name: 'Keep' }, T0);
    const archive = await createRitual(db, { ...POMODORO_DRAFT, name: 'Archive Me' }, T0 + 1);
    await deleteRitual(db, archive.id);

    const rituals = await listRituals(db);
    expect(rituals.map((r) => r.id)).toEqual([keep.id]);
  });

  it('updateRitual replaces fields and fully swaps sound layers, not merges them', async () => {
    const db = await setupDb();
    const created = await createRitual(db, POMODORO_DRAFT, T0);

    await updateRitual(db, created.id, {
      ...POMODORO_DRAFT,
      name: 'Renamed',
      focusMinutes: 50,
      soundLayers: [{ soundId: 'brown-noise', volume: 0.8, position: 0 }],
    });

    const updated = await getRitualById(db, created.id);
    expect(updated?.name).toBe('Renamed');
    expect(updated?.focusMinutes).toBe(50);
    expect(updated?.soundLayers).toEqual([{ soundId: 'brown-noise', volume: 0.8, position: 0 }]);
  });

  it('duplicateRitual copies every field under a collision-avoiding name', async () => {
    const db = await setupDb();
    const original = await createRitual(db, POMODORO_DRAFT, T0);

    const copy = await duplicateRitual(db, original.id, T0 + 1);
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe('Morning Pages (Copy)');
    expect(copy.timerMode).toBe(original.timerMode);
    expect(copy.soundLayers).toEqual(original.soundLayers);

    const secondCopy = await duplicateRitual(db, original.id, T0 + 2);
    expect(secondCopy.name).toBe('Morning Pages (Copy 2)');
  });

  it('duplicating does not mutate the original', async () => {
    const db = await setupDb();
    const original = await createRitual(db, POMODORO_DRAFT, T0);
    await duplicateRitual(db, original.id, T0 + 1);

    const stillOriginal = await getRitualById(db, original.id);
    expect(stillOriginal).toEqual(original);
  });

  it('deleteRitual archives rather than removing the row', async () => {
    const db = await setupDb();
    const created = await createRitual(db, POMODORO_DRAFT, T0);

    await deleteRitual(db, created.id);

    const fetchedDirectly = await getRitualById(db, created.id);
    expect(fetchedDirectly?.isArchived).toBe(true);
    expect(await countRituals(db)).toBe(0);
  });

  it('setRitualFavorite toggles the flag', async () => {
    const db = await setupDb();
    const created = await createRitual(db, POMODORO_DRAFT, T0);

    await setRitualFavorite(db, created.id, true);
    expect((await getRitualById(db, created.id))?.isFavorite).toBe(true);

    await setRitualFavorite(db, created.id, false);
    expect((await getRitualById(db, created.id))?.isFavorite).toBe(false);
  });

  it('markRitualUsed sets lastUsedAt', async () => {
    const db = await setupDb();
    const created = await createRitual(db, POMODORO_DRAFT, T0);
    expect(created.lastUsedAt).toBeNull();

    await markRitualUsed(db, created.id, T0 + 5000);
    expect((await getRitualById(db, created.id))?.lastUsedAt).toBe(T0 + 5000);
  });

  it('countRituals excludes archived rituals', async () => {
    const db = await setupDb();
    expect(await countRituals(db)).toBe(0);

    const a = await createRitual(db, POMODORO_DRAFT, T0);
    await createRitual(db, { ...POMODORO_DRAFT, name: 'Second' }, T0 + 1);
    expect(await countRituals(db)).toBe(2);

    await deleteRitual(db, a.id);
    expect(await countRituals(db)).toBe(1);
  });
});
