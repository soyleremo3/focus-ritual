import { create } from 'zustand';

import * as soundEngine from '@/lib/audio/soundEngine';

export interface ActiveLayer {
  soundId: string;
  volume: number;
}

const DEFAULT_LAYER_VOLUME = 0.7;

interface SoundStoreState {
  activeMix: ActiveLayer[];
  masterPlaying: boolean;
  toggleLayer: (soundId: string) => void;
  setLayerVolume: (soundId: string, volume: number) => void;
  play: () => void;
  pause: () => void;
}

/** Holds only serializable UI state and delegates to the soundEngine singleton as a side effect — never holds AudioPlayer instances itself. */
export const useSoundStore = create<SoundStoreState>()((set, get) => ({
  activeMix: [],
  masterPlaying: false,

  toggleLayer: (soundId) => {
    const { activeMix } = get();
    const isActive = activeMix.some((layer) => layer.soundId === soundId);
    const nextMix = isActive
      ? activeMix.filter((layer) => layer.soundId !== soundId)
      : [...activeMix, { soundId, volume: DEFAULT_LAYER_VOLUME }];

    set({ activeMix: nextMix, masterPlaying: true });
    soundEngine.setMix(nextMix);
    // The mixer sheet is a live preview surface — toggling a layer on is audible
    // immediately, independent of timer state. Timer start/pause also calls play()/pause()
    // to keep ambience in sync during a real session.
    soundEngine.play();
  },

  setLayerVolume: (soundId, volume) => {
    const nextMix = get().activeMix.map((layer) => (layer.soundId === soundId ? { ...layer, volume } : layer));
    set({ activeMix: nextMix });
    soundEngine.setLayerVolume(soundId, volume);
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
