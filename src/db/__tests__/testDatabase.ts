import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Database, RunResult } from '../types';

function toSqlParams(params: unknown[]): SQLInputValue[] {
  return params as SQLInputValue[];
}

/**
 * Real SQLite semantics for tests, backed by Node's built-in node:sqlite — no native
 * module, no mocking of expo-sqlite's bridge, and no extra dependency. Implements the
 * same Database interface the app uses, so migrations/repositories run against genuine
 * SQL rather than a hand-rolled fake.
 */
export function createTestDatabase(): Database {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys = ON');

  return {
    async execAsync(source) {
      native.exec(source);
    },

    async runAsync(source, params) {
      const info = native.prepare(source).run(...toSqlParams(params));
      const result: RunResult = {
        lastInsertRowId: Number(info.lastInsertRowid),
        changes: Number(info.changes),
      };
      return result;
    },

    async getAllAsync<T>(source: string, params: unknown[]) {
      return native.prepare(source).all(...toSqlParams(params)) as T[];
    },

    async getFirstAsync<T>(source: string, params: unknown[]) {
      const row = native.prepare(source).get(...toSqlParams(params));
      return (row ?? null) as T | null;
    },

    async withTransactionAsync(task) {
      native.exec('BEGIN');
      try {
        await task();
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
