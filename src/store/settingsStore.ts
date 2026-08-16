import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import * as settingsRepo from '@/db/repositories/settingsRepo';
import type { AppSettings } from '@/db/repositories/settingsRepo';

export type { AppSettings } from '@/db/repositories/settingsRepo';

/** Matches settingsRepo's row defaults — used until hydrate() resolves, and in tests. */
export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  hapticsEnabled: true,
  notificationsEnabled: true,
  weekStartsOn: 0,
  defaultFocusMinutes: 25,
  defaultBreakMinutes: 5,
  autoStartBreaks: true,
  autoStartNextFocus: false,
  pauseSoundWithTimer: true,
};

interface SettingsStoreState {
  settings: AppSettings;
  /** True once the module-load hydrate() has resolved. */
  loaded: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

/**
 * Guards against two overlapping update() calls resolving out of order — without it, two
 * rapid toggles (e.g. notifications off, then haptics off) could have the first call's
 * slower DB read-back land *after* the second call's, overwriting the second toggle's
 * already-applied state with a stale snapshot and visibly flipping it back.
 */
let updateSequence = 0;

export const useSettingsStore = create<SettingsStoreState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  update: async (patch) => {
    const mySequence = ++updateSequence;
    // Optimistic — Settings toggles should feel instant, not wait on a DB round-trip.
    set({ settings: { ...get().settings, ...patch } });
    try {
      const db = await getDatabase();
      const next = await settingsRepo.updateSettings(db, patch);
      if (mySequence === updateSequence) set({ settings: next });
    } catch (error) {
      console.error('[settingsStore] failed to persist settings', error);
    }
  },
}));

/** Cold-start recovery — runs once at module load, same pattern as soundStore/timerStore. */
async function hydrate(): Promise<void> {
  try {
    const db = await getDatabase();
    const settings = await settingsRepo.getSettings(db);
    useSettingsStore.setState({ settings, loaded: true });
  } catch (error) {
    console.error('[settingsStore] failed to hydrate', error);
  }
}

void hydrate();
