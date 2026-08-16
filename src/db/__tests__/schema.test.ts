import { getSchemaVersion, migrate, MIGRATIONS } from '../schema';
import { createTestDatabase } from './testDatabase';

describe('migrate', () => {
  it('starts at schema version 0 on a fresh database', async () => {
    const db = createTestDatabase();
    expect(await getSchemaVersion(db)).toBe(0);
  });

  it('applies all migrations and bumps the schema version to the latest', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const latest = MIGRATIONS[MIGRATIONS.length - 1];
    expect(latest).toBeDefined();
    expect(await getSchemaVersion(db)).toBe(latest!.version);
  });

  it('creates every planned table', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      []
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'spaces',
        'sounds',
        'rituals',
        'ritual_sound_layers',
        'tasks',
        'sessions',
        'settings',
      ])
    );
  });

  it('is idempotent — running it again on an already-migrated database is a no-op', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const versionAfterFirst = await getSchemaVersion(db);

    await expect(migrate(db)).resolves.not.toThrow();
    expect(await getSchemaVersion(db)).toBe(versionAfterFirst);
  });

  it('enforces the settings table single-row constraint', async () => {
    const db = createTestDatabase();
    await migrate(db);
    await db.runAsync('INSERT INTO settings (id) VALUES (1)', []);
    await expect(db.runAsync('INSERT INTO settings (id) VALUES (2)', [])).rejects.toThrow();
  });
});
