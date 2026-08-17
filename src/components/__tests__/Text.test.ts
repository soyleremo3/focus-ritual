import { variantStyle } from '../Text';

// Minimal stub matching only the theme fields variantStyle actually reads.
const theme = {
  fontFamily: { displaySemiBold: 'x', displayMedium: 'x', sansSemiBold: 'x', sansRegular: 'x' },
  fontSize: { hero: 88, display: 56, xxl: 28, md: 16, xs: 12 },
  lineHeight: { tight: 1.1, normal: 1.4 },
  tracking: { tight: -0.5 },
} as unknown as Parameters<typeof variantStyle>[0];

describe('variantStyle', () => {
  it('uppercases label text (short section headers/badges)', () => {
    expect(variantStyle(theme, 'label').textTransform).toBe('uppercase');
  });

  it('does not uppercase caption text — it renders arbitrary user content', () => {
    const style = variantStyle(theme, 'caption');
    expect(style.textTransform).toBeUndefined();
    expect(style.letterSpacing).toBeUndefined();
  });

  it('caption matches label size/weight, differing only in casing/tracking', () => {
    const label = variantStyle(theme, 'label');
    const caption = variantStyle(theme, 'caption');
    expect(caption.fontFamily).toBe(label.fontFamily);
    expect(caption.fontSize).toBe(label.fontSize);
  });
});
