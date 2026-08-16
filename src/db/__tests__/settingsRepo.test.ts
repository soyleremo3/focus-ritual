import {
  getActiveSoundMix,
  getActiveSpaceId,
  getMasterVolume,
  getOrCreateSettings,
  setActiveSoundMix,
  setActiveSpaceId,
  setMasterVolume,
} from '../repositories/settingsRepo';
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

describe('settingsRepo', () => {
  test('getOrCreateSettings creates the single default row on first touch', async () => {
    const db = await setupDb();
    const settings = await getOrCreateSettings(db);
    expect(settings.id).toBe(1);
    expect(settings.active_space_id).toBeNull();
    expect(settings.active_sound_mix).toBeNull();
    expect(settings.master_volume).toBe(1);
  });

  test('getOrCreateSettings is idempotent — repeated calls return the same row', async () => {
    const db = await setupDb();
    await getOrCreateSettings(db);
    const settings = await getOrCreateSettings(db);
    expect(settings.id).toBe(1);
  });

  test('setActiveSpaceId persists and getActiveSpaceId reads it back', async () => {
    const db = await setupDb();
    await setActiveSpaceId(db, 'rain-window');
    expect(await getActiveSpaceId(db)).toBe('rain-window');
  });

  test('setActiveSpaceId can clear back to null', async () => {
    const db = await setupDb();
    await setActiveSpaceId(db, 'rain-window');
    await setActiveSpaceId(db, null);
    expect(await getActiveSpaceId(db)).toBeNull();
  });

  test('getActiveSoundMix defaults to an empty array', async () => {
    const db = await setupDb();
    expect(await getActiveSoundMix(db)).toEqual([]);
  });

  test('setActiveSoundMix persists and getActiveSoundMix reads it back', async () => {
    const db = await setupDb();
    const mix = [
      { soundId: 'rain', volume: 0.6 },
      { soundId: 'wind', volume: 0.3 },
    ];
    await setActiveSoundMix(db, mix);
    expect(await getActiveSoundMix(db)).toEqual(mix);
  });

  test('setActiveSoundMix can clear back to an empty mix', async () => {
    const db = await setupDb();
    await setActiveSoundMix(db, [{ soundId: 'rain', volume: 0.6 }]);
    await setActiveSoundMix(db, []);
    expect(await getActiveSoundMix(db)).toEqual([]);
  });

  test('getActiveSoundMix tolerates corrupt JSON by returning an empty mix', async () => {
    const db = await setupDb();
    await db.runAsync("UPDATE settings SET active_sound_mix = 'not json' WHERE id = 1", []);
    expect(await getActiveSoundMix(db)).toEqual([]);
  });

  test('master volume defaults to 1 and setMasterVolume persists', async () => {
    const db = await setupDb();
    expect(await getMasterVolume(db)).toBe(1);
    await setMasterVolume(db, 0.4);
    expect(await getMasterVolume(db)).toBe(0.4);
  });
});
