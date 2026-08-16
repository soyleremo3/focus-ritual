import { create } from 'zustand';

import { getDatabase } from '@/db/client';
import * as settingsRepo from '@/db/repositories/settingsRepo';
import { clampVolume, effectiveVolume } from '@/domain/sound/soundEngine';
import { soundEngine } from '@/lib/audio/soundEngine';

export interface ActiveLayer {
  soundId: string;
  volume: number;
}

const DEFAULT_LAYER_VOLUME = 0.7;

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

/** Holds only serializable UI state and delegates to the soundEngine singleton as a side effect — never holds AudioPlayer instances itself. */
export const useSoundStore = create<SoundStoreState>()((set, get) => ({
  activeMix: [],
  masterVolume: 1,
  masterPlaying: false,
  loaded: false,

  toggleLayer: (soundId) => {
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
    const clamped = clampVolume(volume);
    const { masterVolume } = get();
    const nextMix = get().activeMix.map((layer) => (layer.soundId === soundId ? { ...layer, volume: clamped } : layer));
    set({ activeMix: nextMix });
    soundEngine.setLayerVolume(soundId, effectiveVolume(clamped, masterVolume));
    persistMix(nextMix, masterVolume);
  },

  setMasterVolume: (volume) => {
    const clamped = clampVolume(volume);
    const { activeMix } = get();
    set({ masterVolume: clamped });
    applyToEngine(activeMix, clamped);
    persistMix(activeMix, clamped);
  },

  applyRitualMix: (layers) => {
    const { masterVolume } = get();
    set({ activeMix: layers });
    applyToEngine(layers, masterVolume);
  },

  restoreStandaloneMix: async () => {
    const db = await getDatabase();
    const [mix, masterVolume] = await Promise.all([settingsRepo.getActiveSoundMix(db), settingsRepo.getMasterVolume(db)]);
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
    const [mix, masterVolume] = await Promise.all([settingsRepo.getActiveSoundMix(db), settingsRepo.getMasterVolume(db)]);
    useSoundStore.setState({ activeMix: mix, masterVolume, loaded: true });
    applyToEngine(mix, masterVolume);
  } catch (error) {
    console.error('[soundStore] failed to hydrate', error);
  }
}

void hydrate();
