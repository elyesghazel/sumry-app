import { useColorScheme } from 'react-native';

/**
 * Sumry's visual language: calm over clutter.
 *
 * The palette is deliberately almost monochrome. Colour carries exactly one meaning —
 * the direction money moved — so a screenful of numbers reads at a glance instead of
 * turning into confetti. Category colours exist, but only ever appear as a small dot or
 * a tinted icon, never as a filled block.
 */

const positive = { dark: '#7FBFA0', light: '#3E7F60' };
const negative = { dark: '#E08D82', light: '#B4544A' };

type Palette = {
  bg: string;
  bgElevated: string;
  gradientTop: string;
  gradientBottom: string;
  glass: string;
  glassStrong: string;
  hairline: string;
  text: string;
  textMuted: string;
  textFaint: string;
  positive: string;
  negative: string;
  accent: string;
  keypad: string;
  blurTint: 'dark' | 'light';
};

export const palette: { dark: Palette; light: Palette } = {
  dark: {
    // Backdrop: a near-black slate with a hint of blue so the glass has something to pick up.
    bg: '#0B0D10',
    bgElevated: '#12151A',
    gradientTop: '#141A22',
    gradientBottom: '#0B0D10',

    // Glass: a whisper of white over the backdrop, held together by a hairline border.
    glass: 'rgba(255,255,255,0.045)',
    glassStrong: 'rgba(255,255,255,0.07)',
    hairline: 'rgba(255,255,255,0.09)',

    text: '#ECEEF1',
    textMuted: '#9AA1AC',
    textFaint: '#646B76',

    positive: positive.dark,
    negative: negative.dark,
    accent: '#8FA6C4',

    keypad: 'rgba(255,255,255,0.06)',
    blurTint: 'dark',
  },
  light: {
    bg: '#F6F7F9',
    bgElevated: '#FFFFFF',
    gradientTop: '#FFFFFF',
    gradientBottom: '#EDF0F4',

    glass: 'rgba(255,255,255,0.65)',
    glassStrong: 'rgba(255,255,255,0.85)',
    hairline: 'rgba(16,20,28,0.10)',

    text: '#161A20',
    textMuted: '#5C646F',
    textFaint: '#98A0AC',

    positive: positive.light,
    negative: negative.light,
    accent: '#41597A',

    keypad: 'rgba(16,20,28,0.045)',
    blurTint: 'light',
  },
};

export type Theme = Palette;

export const useTheme = (): Theme => {
  const scheme = useColorScheme();
  return scheme === 'light' ? palette.light : palette.dark;
};

/** 4pt spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const type = {
  // Tabular figures keep columns of money from jittering as digits change.
  display: { fontSize: 44, fontWeight: '300' as const, fontVariant: ['tabular-nums' as const] },
  amount: { fontSize: 17, fontWeight: '500' as const, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.6 },
};
