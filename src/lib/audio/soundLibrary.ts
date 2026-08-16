export interface SoundDefinition {
  id: string;
  label: string;
  /** require() asset id — bundled, offline, no dynamic download. */
  source: number;
}

export const soundLibrary: SoundDefinition[] = [
  { id: 'rain', label: 'Rain', source: require('../../../assets/sounds/rain.wav') },
  { id: 'white-noise', label: 'White Noise', source: require('../../../assets/sounds/white-noise.wav') },
  { id: 'brown-noise', label: 'Brown Noise', source: require('../../../assets/sounds/brown-noise.wav') },
];

export function findSoundDefinition(soundId: string): SoundDefinition | undefined {
  return soundLibrary.find((s) => s.id === soundId);
}
