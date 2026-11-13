import { useColorScheme } from 'react-native';

/**
 * Sumry in the eg. look (design.elyesghazel.ch): black page, JetBrains Mono, white for
 * what matters, greys for the rest, a muted brick red for the one thing to look at.
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

const positive = { dark: '#6CC28A', light: '#1E7A44' };
const negative = { dark: '#FF5F56', light: '#D0201F' };

const categoricalLight = ['#0A0A0A', '#A94848', '#1F5FB4', '#1E7A44', '#8F5F00', '#707070', '#6B4C9A', '#B5B5B5'];

const categoricalDark = ['#FFFFFF', '#C47070', '#74A7E6', '#6CC28A', '#D9AD5B', '#A6A6A6', '#B08FD0', '#5F5F5F'];

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
    bg: '#FAFAFA',
    bgElevated: '#FFFFFF',
    bgRecessed: '#F2F2F2',
    hairline: '#D4D4D4',
    hairlineStrong: '#888888',

    text: '#0A0A0A',
    textMuted: '#555555',
    textFaint: '#707070',

    positive: positive.light,
    negative: negative.light,
    accent: '#A94848',

    keypad: '#EBEBEB',
    statusBar: 'dark',
    categorical: categoricalLight,
    grid: '#E3E3E3',

    glass: '#FFFFFF',
    glassStrong: '#FFFFFF',
    gradientTop: '#FAFAFA',
    gradientBottom: '#FAFAFA',
    blurTint: 'light',
  },
  dark: {
    bg: '#000000',
    bgElevated: '#0F0F0F',
    bgRecessed: '#050505',
    hairline: '#333333',
    hairlineStrong: '#666666',

    text: '#FFFFFF',
    textMuted: '#A6A6A6',
    textFaint: '#8A8A8A',

    positive: positive.dark,
    negative: negative.dark,
    accent: '#C47070',

    keypad: '#1A1A1A',
    statusBar: 'light',
    categorical: categoricalDark,
    grid: '#262626',

    glass: '#0F0F0F',
    glassStrong: '#0F0F0F',
    gradientTop: '#000000',
    gradientBottom: '#000000',
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
 * JetBrains Mono everywhere, weight does the work. Weights are referenced by family name
 * rather than fontWeight: on Android a numeric weight against a custom family silently
 * falls back to the system face, so each weight has to be its own family. The serif keys
 * stay so call sites don't change; they resolve to the heavier mono cuts.
 */
export const font = {
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
  semibold: 'JetBrainsMono_600SemiBold',
  light: 'JetBrainsMono_400Regular',
  serifLight: 'JetBrainsMono_600SemiBold',
  serif: 'JetBrainsMono_500Medium',
  serifMedium: 'JetBrainsMono_600SemiBold',
  serifItalic: 'JetBrainsMono_700Bold',
};

/** 4pt spacing scale. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Nearly square, as in eg.: nothing is pill-shaped except status dots.
export const radius = { sm: 2, md: 4, lg: 4, pill: 2 };

export const type = {
  // Tabular figures keep columns of money from jittering as digits change.
  display: { fontSize: 40, fontFamily: font.serifLight, fontVariant: ['tabular-nums' as const], letterSpacing: -1.5 },
  amount: { fontSize: 15, fontFamily: font.serif, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 22, fontFamily: font.serifMedium, letterSpacing: -0.5 },
  body: { fontSize: 14, fontFamily: font.regular },
  label: { fontSize: 13, fontFamily: font.medium },
  caption: { fontSize: 11, fontFamily: font.medium, letterSpacing: 2 },
};
