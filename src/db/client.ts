import * as SQLite from 'expo-sqlite';

import { migrate } from './schema';
import { seedBundledData } from './seed';
import { seedExampleRitualsIfEmpty } from './seedExampleRituals';
import type { Database } from './types';

const DATABASE_NAME = 'focusritual.db';

function wrapNativeDatabase(native: SQLite.SQLiteDatabase): Database {
  return {
    execAsync: (source) => native.execAsync(source),
    runAsync: (source, params) => native.runAsync(source, params as SQLite.SQLiteBindParams),
    getAllAsync: (source, params) => native.getAllAsync(source, params as SQLite.SQLiteBindParams),
    getFirstAsync: (source, params) => native.getFirstAsync(source, params as SQLite.SQLiteBindParams),
    withTransactionAsync: (task) => native.withTransactionAsync(task),
  };
}

let databasePromise: Promise<Database> | null = null;

async function initDatabase(): Promise<Database> {
  const native = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = wrapNativeDatabase(native);
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
  await seedBundledData(db);
  await seedExampleRitualsIfEmpty(db);
  return db;
}

/**
 * Lazily opens the database once and memoizes it for the app's lifetime — every caller
 * (timerStore, future repositories) awaits the same promise rather than each opening
 * their own connection.
 */
export function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = initDatabase();
  }
  return databasePromise;
}
