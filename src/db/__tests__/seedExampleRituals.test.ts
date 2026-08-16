import { countRituals, createRitual, deleteRitual, listRituals } from '../repositories/ritualsRepo';
import { migrate } from '../schema';
import { seedBundledData } from '../seed';
import { seedExampleRitualsIfEmpty } from '../seedExampleRituals';
import { createTestDatabase } from './testDatabase';

const T0 = 1_700_000_000_000;

describe('seedExampleRitualsIfEmpty', () => {
  it('seeds exactly 3 example rituals on a fresh database', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    await seedExampleRitualsIfEmpty(db, T0);

    const rituals = await listRituals(db);
    expect(rituals).toHaveLength(3);
    expect(rituals.every((r) => r.spaceId != null)).toBe(true);
    expect(rituals.every((r) => r.soundLayers.length > 0)).toBe(true);
  });

  it('is a permanent no-op once the user has any ritual, even after calling it many times', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    await seedExampleRitualsIfEmpty(db, T0);
    await seedExampleRitualsIfEmpty(db, T0 + 1);
    await seedExampleRitualsIfEmpty(db, T0 + 2);

    expect(await countRituals(db)).toBe(3);
  });

  it('does not re-seed after the user deletes every example ritual', async () => {
    // This is the behavior that distinguishes it from seedBundledData's INSERT-OR-IGNORE
    // reference rows: "only if the user has none" is a one-time condition, not a
    // permanently-enforced minimum.
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);
    await seedExampleRitualsIfEmpty(db, T0);

    const seeded = await listRituals(db);
    for (const ritual of seeded) {
      await deleteRitual(db, ritual.id);
    }
    expect(await countRituals(db)).toBe(0);

    await seedExampleRitualsIfEmpty(db, T0 + 1000);
    expect(await countRituals(db)).toBe(0);
  });

  it('does not touch rituals the user already created', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await seedBundledData(db, T0);

    const userRitual = await createRitual(
      db,
      {
        name: 'My Own Ritual',
        timerMode: 'custom',
        focusMinutes: 33,
        breakMinutes: 7,
        cyclesTarget: null,
        spaceId: null,
        soundLayers: [],
      },
      T0
    );

    await seedExampleRitualsIfEmpty(db, T0 + 1);

    // A user ritual already existed, so the "only if none" condition never triggers.
    const rituals = await listRituals(db);
    expect(rituals.map((r) => r.id)).toEqual([userRitual.id]);
  });
});
