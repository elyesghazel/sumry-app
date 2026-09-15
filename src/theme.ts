import { useColorScheme } from 'react-native';

/**
 * Sumry's visual language: the ledger. Paper, ink, hairlines.
 *
 * Two colour systems live here and they do different jobs.
 *
 * The UI palette is near-monochrome. Colour there means exactly one thing — the
 * direction money moved — so a screen full of numbers reads at a glance. Light is the
 * primary palette; dark is its own set, not an inversion.
 *
 * The categorical palette identifies spending categories in charts: eight earth tones,
 * assigned by category identity and never cycled — an entity keeps its colour no matter
 * what else is on screen or how the list is filtered.
 */

const positive = { dark: '#7FB995', light: '#2F6B4F' };
const negative = { dark: '#E0836F', light: '#A63D2F' };

const categoricalLight = [
  '#9A6B1F', // ochre
  '#B4553A', // terracotta
  '#5B7A3A', // moss
  '#4D6B86', // slate
  '#7D5478', // plum
  '#2F7D78', // teal
  '#8A6A4B', // umber
  '#A8566B', // rose
];

const categoricalDark = [
  '#D1A353',
  '#E0836F',
  '#9FBF6E',
  '#8FB0CC',
  '#C493BF',
  '#6FC2BB',
  '#C9A583',
  '#E08AA2',
];

type Palette = {
  bg: string;
  bgElevated: string;
  /** Recessed ground for keys, tracks and pressed states. */
  bgRecessed: string;
  hairline: string;
  hairlineStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  positive: string;
  negative: string;
  accent: string;
  keypad: string;
  statusBar: 'dark' | 'light';
  categorical: string[];
  /** Recessive grid/axis ink for charts. */
  grid: string;
  // Kept for the few call sites that still name them; both resolve to flat surfaces now.
  glass: string;
  glassStrong: string;
  gradientTop: string;
  gradientBottom: string;
  blurTint: 'dark' | 'light';
};

export const palette: { dark: Palette; light: Palette } = {
  light: {
    bg: '#F4F1EA',
    bgElevated: '#FBFAF6',
    bgRecessed: '#EBE7DE',
    hairline: 'rgba(26,24,20,0.14)',
    hairlineStrong: 'rgba(26,24,20,0.36)',

    text: '#1A1814',
    textMuted: '#4F4A43',
    textFaint: '#8B857B',

    positive: positive.light,
    negative: negative.light,
    accent: '#9A6B1F',

    keypad: '#EBE7DE',
    statusBar: 'dark',
    categorical: categoricalLight,
    grid: 'rgba(26,24,20,0.12)',

    glass: '#FBFAF6',
    glassStrong: '#FBFAF6',
    gradientTop: '#F4F1EA',
    gradientBottom: '#F4F1EA',
    blurTint: 'light',
  },
  dark: {
    bg: '#17150F',
    bgElevated: '#1E1B15',
    bgRecessed: '#100F0B',
    hairline: 'rgba(236,230,217,0.14)',
    hairlineStrong: 'rgba(236,230,217,0.38)',

    text: '#ECE6D9',
    textMuted: '#B3AB9C',
    textFaint: '#766F63',

    positive: positive.dark,
    negative: negative.dark,
    accent: '#D1A353',

    keypad: '#100F0B',
    statusBar: 'light',
    categorical: categoricalDark,
    grid: 'rgba(236,230,217,0.12)',

    glass: '#1E1B15',
    glassStrong: '#1E1B15',
    gradientTop: '#17150F',
    gradientBottom: '#17150F',
    blurTint: 'dark',
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
  return systemScheme === 'dark' ? palette.dark : palette.light;
};

/**
 * Falls back to the system scheme. Screens should prefer `useTheme` from
 * `preferences.tsx`, which honours the user's chosen mode; this stays as the default
 * for anything rendered outside the provider.
 */
export const useSystemTheme = (): Theme => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
};

/** Stable colour for a category, so it never changes as lists are filtered. */
export function categoryColor(theme: Theme, key: string, explicit?: string | null): string {
  if (explicit && /^#[0-9a-f]{6}$/i.test(explicit)) return explicit;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return theme.categorical[hash % theme.categorical.length];
}

/**
 * Fraunces carries the figures and titles, Inter everything else. Weights are referenced
 * by family name rather than fontWeight: on Android a numeric weight against a custom
 * family silently falls back to the system face, so each weight has to be its own family.
 */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  light: 'Inter_400Regular',
  serifLight: 'Fraunces_300Light',
  serif: 'Fraunces_400Regular',
  serifMedium: 'Fraunces_500Medium',
  serifItalic: 'Fraunces_500Medium_Italic',
};

/** 4pt spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 10, lg: 12, pill: 999 };

export const type = {
  // Tabular figures keep columns of money from jittering as digits change.
  display: { fontSize: 46, fontFamily: font.serifLight, fontVariant: ['tabular-nums' as const], letterSpacing: -1 },
  amount: { fontSize: 17, fontFamily: font.serif, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 26, fontFamily: font.serif, letterSpacing: -0.3 },
  body: { fontSize: 15, fontFamily: font.regular },
  label: { fontSize: 13, fontFamily: font.medium },
  caption: { fontSize: 11, fontFamily: font.medium, letterSpacing: 0.8 },
};
