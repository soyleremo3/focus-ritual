import { createAudioPlayer } from 'expo-audio';

const source = require('../../../assets/sounds/phase-complete.wav') as number;

/**
 * One-shot Focus/Break completion alert — separate from the ambient mixer (domain/sound):
 * that engine is built for persistent, ramping, togglable loops, not a single short sound
 * that plays once and releases itself. Played directly rather than relying solely on the
 * scheduled local notification's sound, since that notification gets cancelled by the same
 * transition's own re-sync the moment the app is foregrounded when it fires — this fires
 * immediately and audibly regardless of that race or of Expo Go's local-notification
 * reliability.
 */
export function playPhaseCompleteChime(): void {
  const player = createAudioPlayer(source);
  player.volume = 0.8;
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) return;
    subscription.remove();
    player.remove();
  });
  player.play();
}
