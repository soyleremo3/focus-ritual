import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import * as settingsRepo from '@/db/repositories/settingsRepo';
import * as spacesRepo from '@/db/repositories/spacesRepo';
import type { CustomSpaceDraft, CustomSpaceUpdate } from '@/db/repositories/spacesRepo';
import { sortSpaces } from '@/domain/space/space';
import type { Space } from '@/domain/space/types';
import { defaultSceneId } from '@/theme/scenePalettes';

interface SpaceStoreState {
  spaces: Space[];
  /** The user's standalone (non-ritual) Focus Space pick — persisted via settingsRepo. */
  activeSpaceId: string;
  /** True once the first refresh() has resolved. */
  loaded: boolean;
  /** Set when refresh() fails (e.g. a DB read error) — lets the screen show a retry state instead of a blank grid. */
  error: string | null;
  refresh: () => Promise<void>;
  /** Explicit user pick from the gallery — persists and marks the space used. */
  selectSpace: (id: string) => Promise<void>;
  createCustom: (draft: CustomSpaceDraft) => Promise<Space>;
  updateCustom: (id: string, patch: CustomSpaceUpdate) => Promise<void>;
  archiveCustom: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

/** Wraps spacesRepo + settingsRepo and keeps a favorite/last-used-sorted in-memory cache. */
export const useSpaceStore = create<SpaceStoreState>()((set, get) => ({
  spaces: [],
  activeSpaceId: defaultSceneId,
  loaded: false,
  error: null,

  refresh: async () => {
    try {
      const db = await getDatabase();
      const spaces = await spacesRepo.listSpaces(db);
      set({ spaces: sortSpaces(spaces), loaded: true, error: null });
    } catch (error) {
      console.error('[spaceStore] failed to refresh', error);
      set({ loaded: true, error: 'Could not load Focus Spaces.' });
    }
  },

  selectSpace: async (id) => {
    set({ activeSpaceId: id });
    const db = await getDatabase();
    await settingsRepo.setActiveSpaceId(db, id);
    await spacesRepo.markSpaceUsed(db, id);
    await get().refresh();
  },

  createCustom: async (draft) => {
    const db = await getDatabase();
    const created = await spacesRepo.createCustomSpace(db, draft);
    await get().refresh();
    return created;
  },

  updateCustom: async (id, patch) => {
    const db = await getDatabase();
    await spacesRepo.updateCustomSpace(db, id, patch);
    await get().refresh();
  },

  archiveCustom: async (id) => {
    const db = await getDatabase();
    await spacesRepo.archiveCustomSpace(db, id);
    // A deleted space can't stay the active standalone pick — fall back to the default
    // bundled scene so the Focus screen never points at an archived space.
    if (get().activeSpaceId === id) {
      set({ activeSpaceId: defaultSceneId });
      await settingsRepo.setActiveSpaceId(db, defaultSceneId);
    }
    await get().refresh();
  },

  toggleFavorite: async (id) => {
    const space = get().spaces.find((s) => s.id === id);
    if (!space) return;
    const db = await getDatabase();
    await spacesRepo.setSpaceFavorite(db, id, !space.isFavorite);
    await get().refresh();
  },
}));

/** Runs once at module load — loads the persisted standalone space pick, then the gallery list. */
async function hydrate(): Promise<void> {
  try {
    const db = await getDatabase();
    const activeSpaceId = await settingsRepo.getActiveSpaceId(db);
    if (activeSpaceId) useSpaceStore.setState({ activeSpaceId });
    await useSpaceStore.getState().refresh();
  } catch (error) {
    console.error('[spaceStore] failed to hydrate', error);
  }
}

void hydrate();
