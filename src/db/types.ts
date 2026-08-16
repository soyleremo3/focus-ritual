/**
 * Minimal surface every repository depends on — matches the subset of expo-sqlite's
 * SQLiteDatabase that this app uses. Repositories take a Database as an explicit
 * parameter (dependency injection, not a module-level singleton import), so tests can
 * pass a different Database implementation without touching a native module.
 */
export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Database {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: unknown[]): Promise<RunResult>;
  getAllAsync<T>(source: string, params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: unknown[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
