import { contrastRatio, hexToRgb, isDark, relativeLuminance } from '../palette/paletteContrast';

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 });
  });

  it('parses 3-digit shorthand hex', () => {
    expect(hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0 });
  });
});

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black against white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a color against itself', () => {
    expect(contrastRatio('#5B4636', '#5B4636')).toBeCloseTo(1, 5);
  });
});

describe('isDark', () => {
  it('is true for black and false for white', () => {
    expect(isDark('#000000')).toBe(true);
    expect(isDark('#FFFFFF')).toBe(false);
  });

  it('picks whichever text color has higher contrast for a mid-tone background', () => {
    // A warm mid-brown (Amber Study-ish) — white text should read better than black.
    expect(isDark('#4A3728')).toBe(true);
    // A pale cream — black text should read better than white.
    expect(isDark('#F3E9D2')).toBe(false);
  });
});
