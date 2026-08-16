import { getSchemaVersion, migrate, MIGRATIONS } from '../schema';
import type { Database } from '../types';
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

  it('writes PRAGMA user_version inside the same transaction as its migration statements', async () => {
    // Regression: the version bump used to run in a separate execAsync call after the
    // migration's own transaction had already committed. A process kill landing in that
    // gap left the schema changed but the version stale, so the next launch re-applied
    // the same migration and crashed (CREATE TABLE on an existing table, duplicate ALTER
    // TABLE ADD COLUMN) — bricking the app until reinstall. Asserting the PRAGMA call
    // happens before COMMIT proves there's no longer a gap for a kill to land in.
    const calls: string[] = [];
    const spyDb: Database = {
      execAsync: async (source) => {
        calls.push(`exec:${source}`);
      },
      runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
      getAllAsync: async () => [],
      getFirstAsync: async <T>() => ({ user_version: 0 }) as T,
      withTransactionAsync: async (task) => {
        calls.push('BEGIN');
        await task();
        calls.push('COMMIT');
      },
    };

    await migrate(spyDb);

    const firstCommitIndex = calls.indexOf('COMMIT');
    expect(firstCommitIndex).toBeGreaterThan(-1);
    const callsBeforeFirstCommit = calls.slice(0, firstCommitIndex);
    expect(callsBeforeFirstCommit.some((c) => c.includes(`PRAGMA user_version = ${MIGRATIONS[0]!.version}`))).toBe(
      true
    );
  });
});
