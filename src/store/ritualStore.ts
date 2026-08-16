import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import * as ritualsRepo from '@/db/repositories/ritualsRepo';
import type { RitualDraft } from '@/db/repositories/ritualsRepo';
import { sortRituals } from '@/domain/ritual/ritual';
import type { Ritual } from '@/domain/ritual/types';

interface RitualStoreState {
  rituals: Ritual[];
  /** True once the first refresh() has resolved — lets screens distinguish "loading" from "genuinely empty". */
  loaded: boolean;
  refresh: () => Promise<void>;
  create: (draft: RitualDraft) => Promise<Ritual>;
  update: (id: string, draft: RitualDraft) => Promise<void>;
  duplicate: (id: string) => Promise<Ritual>;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
}

/** Wraps ritualsRepo and keeps an in-memory, favorite/last-used-sorted cache — every mutation refreshes it. */
export const useRitualStore = create<RitualStoreState>()((set, get) => ({
  rituals: [],
  loaded: false,

  refresh: async () => {
    const db = await getDatabase();
    const rituals = await ritualsRepo.listRituals(db);
    set({ rituals: sortRituals(rituals), loaded: true });
  },

  create: async (draft) => {
    const db = await getDatabase();
    const created = await ritualsRepo.createRitual(db, draft, Date.now());
    await get().refresh();
    return created;
  },

  update: async (id, draft) => {
    const db = await getDatabase();
    await ritualsRepo.updateRitual(db, id, draft);
    await get().refresh();
  },

  duplicate: async (id) => {
    const db = await getDatabase();
    const created = await ritualsRepo.duplicateRitual(db, id, Date.now());
    await get().refresh();
    return created;
  },

  remove: async (id) => {
    const db = await getDatabase();
    await ritualsRepo.deleteRitual(db, id);
    await get().refresh();
  },

  toggleFavorite: async (id) => {
    const ritual = get().rituals.find((r) => r.id === id);
    if (!ritual) return;
    const db = await getDatabase();
    await ritualsRepo.setRitualFavorite(db, id, !ritual.isFavorite);
    await get().refresh();
  },

  markUsed: async (id) => {
    const db = await getDatabase();
    await ritualsRepo.markRitualUsed(db, id, Date.now());
    await get().refresh();
  },
}));
