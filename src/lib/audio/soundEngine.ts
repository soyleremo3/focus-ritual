import { createAudioPlayer } from 'expo-audio';

import { createSoundEngine } from '@/domain/sound/soundEngine';
import type { EnginePlayer } from '@/domain/sound/types';

import { findSoundDefinition } from './soundLibrary';

function createRealPlayer(soundId: string): EnginePlayer | null {
  const definition = findSoundDefinition(soundId);
  if (!definition) return null;
  return createAudioPlayer(definition.source);
}

/**
 * The app's single sound engine instance — real expo-audio players plugged into the
 * framework-independent core in domain/sound/soundEngine.ts. See that module for the
 * ramping/crossfade/lock-screen-ownership logic and its unit tests.
 */
export const soundEngine = createSoundEngine({ createPlayer: createRealPlayer });
