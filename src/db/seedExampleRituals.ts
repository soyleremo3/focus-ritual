import { countAllRituals, createRitual, type RitualDraft } from './repositories/ritualsRepo';
import type { Database } from './types';

/**
 * 3 hand-picked rituals, one per bundled Focus Space, showing off what a ritual actually
 * composes (mode + durations + space + a tasteful sound mix) without overwhelming a new
 * user with a long list.
 */
const EXAMPLE_RITUALS: RitualDraft[] = [
  {
    name: 'Morning Pages',
    timerMode: 'pomodoro',
    focusMinutes: 25,
    breakMinutes: 5,
    cyclesTarget: 4,
    spaceId: 'amber-study',
    soundLayers: [{ soundId: 'rain', volume: 0.5, position: 0 }],
  },
  {
    name: 'Deep Work Session',
    timerMode: 'deepWork',
    focusMinutes: 50,
    breakMinutes: 10,
    cyclesTarget: null,
    spaceId: 'rain-window',
    soundLayers: [
      { soundId: 'brown-noise', volume: 0.6, position: 0 },
      { soundId: 'rain', volume: 0.3, position: 1 },
    ],
  },
  {
    name: 'Night Owl Flow',
    timerMode: 'flow',
    focusMinutes: 45,
    breakMinutes: 15,
    cyclesTarget: null,
    spaceId: 'midnight-forest',
    soundLayers: [{ soundId: 'white-noise', volume: 0.4, position: 0 }],
  },
];

/**
 * Seeds the 3 example rituals only when the user has never had one at all — unlike
 * seedBundledData's permanent INSERT-OR-IGNORE reference rows, this is a one-time
 * "give a new install something to start from," not a row this always ensures exists.
 * Uses countAllRituals (includes archived), not countRituals — otherwise deleting every
 * example ritual would bring the active count back to 0 and resurrect them on the next
 * app start. Once the user has ever had a ritual (created or seeded), this is permanently
 * a no-op, whether or not any are still active.
 */
export async function seedExampleRitualsIfEmpty(db: Database, now: number = Date.now()): Promise<void> {
  const existing = await countAllRituals(db);
  if (existing > 0) return;

  for (const draft of EXAMPLE_RITUALS) {
    await createRitual(db, draft, now);
  }
}
