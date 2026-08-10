import { useColorScheme } from 'react-native';

/**
 * Sumry's visual language: calm, but not colourless.
 *
 * Two colour systems live here and they do different jobs.
 *
 * The UI palette is near-monochrome. Colour there means exactly one thing — the
 * direction money moved — so a screen full of numbers reads at a glance.
 *
 * The categorical palette identifies spending categories in charts. It is generated in
 * OKLCH and validated: every hue sits inside its mode's lightness band, clears the
 * chroma floor, holds >= 3:1 against the surface, and keeps adjacent pairs apart for
 * normal and colour-deficient vision. Neighbours are separated on two axes at once —
 * hue order alternates across the wheel and lightness alternates between two steps — so
 * no adjacent pair depends on hue alone. Do not hand-edit these; regenerate and re-run
 * the validator.
 */

const positive = { dark: '#7FBFA0', light: '#3E7F60' };
const negative = { dark: '#E08D82', light: '#B4544A' };

// Fixed order. Assigned by category identity and never cycled — an entity keeps its
// colour no matter what else is on screen or how the list is filtered.
const categoricalDark = [
  '#4A97E1', // blue
  '#AE7200', // amber
  '#C072B9', // magenta
  '#25975B', // green
  '#8881DE', // indigo
  '#C45B56', // red
  '#00A6A7', // teal
  '#838300', // olive
];

const categoricalLight = [
  '#2878C0',
  '#955A00',
  '#A3579D',
  '#007C42',
  '#6E66C0',
  '#A9433F',
  '#00A1A2',
  '#696800',
];

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
  categorical: string[];
  /** Recessive grid/axis ink for charts. */
  grid: string;
};

export const palette: { dark: Palette; light: Palette } = {
  dark: {
    bg: '#0B0D10',
    bgElevated: '#12151A',
    gradientTop: '#141A22',
    gradientBottom: '#0B0D10',

    glass: 'rgba(255,255,255,0.045)',
    glassStrong: 'rgba(255,255,255,0.07)',
    hairline: 'rgba(255,255,255,0.09)',

    text: '#ECEEF1',
    textMuted: '#9AA1AC',
    textFaint: '#646B76',

    positive: positive.dark,
    negative: negative.dark,
    accent: '#4A97E1',

    keypad: 'rgba(255,255,255,0.06)',
    blurTint: 'dark',
    categorical: categoricalDark,
    grid: 'rgba(255,255,255,0.07)',
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
    accent: '#2878C0',

    keypad: 'rgba(16,20,28,0.045)',
    blurTint: 'light',
    categorical: categoricalLight,
    grid: 'rgba(16,20,28,0.08)',
  },
};

export type Theme = Palette;
export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Resolves the palette for a mode. `system` follows the OS; the other two override it,
 * which is what the appearance setting writes.
 */
export const resolveTheme = (mode: ThemeMode, systemScheme: string | null | undefined): Theme => {
  if (mode === 'light') return palette.light;
  if (mode === 'dark') return palette.dark;
  return systemScheme === 'light' ? palette.light : palette.dark;
};

/**
 * Falls back to the system scheme. Screens should prefer `useTheme` from
 * `preferences.tsx`, which honours the user's chosen mode; this stays as the default
 * for anything rendered outside the provider.
 */
export const useSystemTheme = (): Theme => {
  const scheme = useColorScheme();
  return scheme === 'light' ? palette.light : palette.dark;
};

/** Stable colour for a category, so it never changes as lists are filtered. */
export function categoryColor(theme: Theme, key: string, explicit?: string | null): string {
  if (explicit && /^#[0-9a-f]{6}$/i.test(explicit)) return explicit;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return theme.categorical[hash % theme.categorical.length];
}

/**
 * Figtree, loaded at startup. Weights are referenced by family name rather than
 * fontWeight: on Android a numeric weight against a custom family silently falls back to
 * the system face, so each weight has to be its own family.
 */
export const font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  light: 'Figtree_300Light',
};

/** 4pt spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const type = {
  // Tabular figures keep columns of money from jittering as digits change.
  display: { fontSize: 44, fontFamily: font.light, fontVariant: ['tabular-nums' as const] },
  amount: { fontSize: 17, fontFamily: font.medium, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 20, fontFamily: font.semibold },
  body: { fontSize: 15, fontFamily: font.regular },
  label: { fontSize: 13, fontFamily: font.medium },
  caption: { fontSize: 11, fontFamily: font.medium, letterSpacing: 0.6 },
};
