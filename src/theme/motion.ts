import { Easing } from 'react-native-reanimated';

/**
 * Restrained-motion rule: motion communicates state change, it never decorates for its
 * own sake. No bouncing, no confetti, no spinning icons. The only permitted continuous/
 * looping animations are (1) a slow, low-amplitude ambient parallax/glow on the active
 * Focus Space while a session is running, and (2) the timer ring's own progress sweep.
 * Everything else animates once, in response to a discrete user action, and settles
 * within ~400ms.
 */
export const durations = {
  instant: 0,
  quick: 150,
  base: 250,
  slow: 400,
  ambient: 6000,
} as const;

export const easing = {
  /** Soft ease-out, for entrances/dismissals. */
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  /** Continuous ambient loops only. */
  gentle: Easing.inOut(Easing.quad),
} as const;

/** Critically damped — no visible bounce/overshoot. Direct-manipulation feedback only. */
export const springConfig = {
  damping: 20,
  stiffness: 200,
  mass: 0.5,
} as const;
