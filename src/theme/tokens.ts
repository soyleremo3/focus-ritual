export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 19,
  xl: 24,
  xxl: 32,
  display: 56,
  hero: 88,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/** Tight (1.1) for display/hero numerals, normal (1.4) for body text. */
export const lineHeight = {
  tight: 1.1,
  normal: 1.4,
} as const;

/** Small negative tracking on hero timer digits — an editorial-numerals touch. */
export const tracking = {
  tight: -0.5,
  normal: 0,
} as const;
