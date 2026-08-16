import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import * as settingsRepo from '@/db/repositories/settingsRepo';
import { clampVolume, effectiveVolume } from '@/domain/sound/soundEngine';
import { soundEngine } from '@/lib/audio/soundEngine';
import { findSoundDefinition } from '@/lib/audio/soundLibrary';

export interface ActiveLayer {
  soundId: string;
  volume: number;
}

const DEFAULT_LAYER_VOLUME = 0.7;

/**
 * Drops any layer whose soundId no longer exists in the bundled library. Without this, a
 * persisted mix referencing a removed sound would load a "ghost" layer that SoundMixEditor
 * can never render a row for (it only iterates the current library), so the user has no
 * way to ever toggle it off — permanently stuck in the DB, re-serialized by every save.
 */
function filterKnownLayers(mix: ActiveLayer[]): ActiveLayer[] {
  return mix.filter((layer) => findSoundDefinition(layer.soundId) != null);
}

interface SoundStoreState {
  activeMix: ActiveLayer[];
  masterVolume: number;
  masterPlaying: boolean;
  /** True once the module-load hydrate() has resolved. */
  loaded: boolean;

  toggleLayer: (soundId: string) => void;
  setLayerVolume: (soundId: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  /** Applies a ritual's saved mix as a live override — never persisted as the standalone baseline. */
  applyRitualMix: (layers: ActiveLayer[]) => void;
  /** Re-reads the persisted standalone mix — used when a plain (non-ritual) session releases a ritual's override. */
  restoreStandaloneMix: () => Promise<void>;
  play: () => void;
  pause: () => void;
}

function applyToEngine(mix: ActiveLayer[], masterVolume: number): void {
  soundEngine.setMix(mix.map((l) => ({ soundId: l.soundId, volume: effectiveVolume(l.volume, masterVolume) })));
}

/** Fire-and-forget persistence — store actions stay synchronous so call sites don't need to await them. */
function persistMix(mix: ActiveLayer[], masterVolume: number): void {
  getDatabase()
    .then((db) => Promise.all([settingsRepo.setActiveSoundMix(db, mix), settingsRepo.setMasterVolume(db, masterVolume)]))
    .catch((error: unknown) => {
      console.error('[soundStore] failed to persist mix', error);
    });
}

/**
 * Set the moment any mutating action runs, before hydrate() has necessarily resolved.
 * hydrate() checks this before applying its (by-then possibly stale) read — without it, a
 * user toggling a layer on during a slow first boot could have that toggle silently
 * reverted moments later when hydrate()'s earlier-queued read resolves and overwrites the
 * store with the pre-toggle mix, leaving the DB, store, and engine all disagreeing.
 */
let hasMutatedSinceLoad = false;

/** Holds only serializable UI state and delegates to the soundEngine singleton as a side effect — never holds AudioPlayer instances itself. */
export const useSoundStore = create<SoundStoreState>()((set, get) => ({
  activeMix: [],
  masterVolume: 1,
  masterPlaying: false,
  loaded: false,

  toggleLayer: (soundId) => {
    hasMutatedSinceLoad = true;
    const { activeMix, masterVolume } = get();
    const isActive = activeMix.some((layer) => layer.soundId === soundId);
    const nextMix = isActive
      ? activeMix.filter((layer) => layer.soundId !== soundId)
      : [...activeMix, { soundId, volume: DEFAULT_LAYER_VOLUME }];

    set({ activeMix: nextMix, masterPlaying: true });
    applyToEngine(nextMix, masterVolume);
    // The mixer is a live preview surface — toggling a layer on is audible immediately,
    // independent of timer state. Timer start/pause also calls play()/pause() to keep
    // ambience in sync during a real session.
    soundEngine.play();
    persistMix(nextMix, masterVolume);
  },

  setLayerVolume: (soundId, volume) => {
    hasMutatedSinceLoad = true;
    const { masterVolume, activeMix } = get();
    // A soundId absent from activeMix means its layer is mid-fade-out toward removal (or
    // was never added) — calling soundEngine.setLayerVolume for it anyway would resurrect
    // a player that's being torn down, with no UI row left to ever turn it back off. This
    // is reachable via a queued VolumeBar gesture commit landing just after the layer was
    // dropped (e.g. applyRitualMix swapping in a mix that no longer includes it).
    if (!activeMix.some((layer) => layer.soundId === soundId)) return;
    const clamped = clampVolume(volume);
    const nextMix = activeMix.map((layer) => (layer.soundId === soundId ? { ...layer, volume: clamped } : layer));
    set({ activeMix: nextMix });
    soundEngine.setLayerVolume(soundId, effectiveVolume(clamped, masterVolume));
    persistMix(nextMix, masterVolume);
  },

  setMasterVolume: (volume) => {
    hasMutatedSinceLoad = true;
    const clamped = clampVolume(volume);
    const { activeMix } = get();
    set({ masterVolume: clamped });
    applyToEngine(activeMix, clamped);
    persistMix(activeMix, clamped);
  },

  applyRitualMix: (layers) => {
    hasMutatedSinceLoad = true;
    const { masterVolume } = get();
    set({ activeMix: layers });
    applyToEngine(layers, masterVolume);
  },

  restoreStandaloneMix: async () => {
    hasMutatedSinceLoad = true;
    const db = await getDatabase();
    const [rawMix, masterVolume] = await Promise.all([
      settingsRepo.getActiveSoundMix(db),
      settingsRepo.getMasterVolume(db),
    ]);
    const mix = filterKnownLayers(rawMix);
    set({ activeMix: mix, masterVolume });
    applyToEngine(mix, masterVolume);
  },

  play: () => {
    set({ masterPlaying: true });
    soundEngine.play();
  },

  pause: () => {
    set({ masterPlaying: false });
    soundEngine.pause();
  },
}));

/**
 * Cold-start recovery — runs once at module load. Restores the persisted mix and master
 * volume into both the store and the engine, but never auto-plays: ambient audio starting
 * on its own the instant the app opens would be surprising. Playback resumes only via an
 * explicit user action, or via FocusScreen applying a recovered running ritual session.
 */
async function hydrate(): Promise<void> {
  try {
    const db = await getDatabase();
    const [rawMix, masterVolume] = await Promise.all([
      settingsRepo.getActiveSoundMix(db),
      settingsRepo.getMasterVolume(db),
    ]);
    // A user can toggle a layer (or otherwise mutate the mix) before this slow first-boot
    // read resolves — applying it at that point would silently revert their action: store
    // and engine snap back to the pre-toggle mix while the DB (already rewritten by that
    // mutation's own persistMix) keeps the new one, leaving all three in disagreement.
    if (hasMutatedSinceLoad) {
      useSoundStore.setState({ loaded: true });
      return;
    }
    const mix = filterKnownLayers(rawMix);
    useSoundStore.setState({ activeMix: mix, masterVolume, loaded: true });
    applyToEngine(mix, masterVolume);
  } catch (error) {
    console.error('[soundStore] failed to hydrate', error);
  }
}

void hydrate();
