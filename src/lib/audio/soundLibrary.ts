export type SoundCategory = 'nature' | 'noise' | 'ambience';

export const SOUND_CATEGORY_LABELS: Record<SoundCategory, string> = {
  nature: 'Nature',
  noise: 'Noise',
  ambience: 'Ambience',
};

export interface SoundDefinition {
  id: string;
  label: string;
  category: SoundCategory;
  /** require() asset id — bundled, offline, no dynamic download. */
  source: number;
}

export const soundLibrary: SoundDefinition[] = [
  { id: 'rain', label: 'Rain', category: 'nature', source: require('../../../assets/sounds/rain.wav') },
  {
    id: 'ocean-waves',
    label: 'Ocean Waves',
    category: 'nature',
    source: require('../../../assets/sounds/ocean-waves.wav'),
  },
  { id: 'wind', label: 'Wind', category: 'nature', source: require('../../../assets/sounds/wind.wav') },
  {
    id: 'white-noise',
    label: 'White Noise',
    category: 'noise',
    source: require('../../../assets/sounds/white-noise.wav'),
  },
  {
    id: 'brown-noise',
    label: 'Brown Noise',
    category: 'noise',
    source: require('../../../assets/sounds/brown-noise.wav'),
  },
  {
    id: 'pink-noise',
    label: 'Pink Noise',
    category: 'noise',
    source: require('../../../assets/sounds/pink-noise.wav'),
  },
  {
    id: 'fireplace',
    label: 'Fireplace',
    category: 'ambience',
    source: require('../../../assets/sounds/fireplace.wav'),
  },
];

export function findSoundDefinition(soundId: string): SoundDefinition | undefined {
  return soundLibrary.find((s) => s.id === soundId);
}
