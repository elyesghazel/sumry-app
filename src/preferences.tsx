import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Theme, ThemeMode, resolveTheme } from './theme';

const KEY = 'sumry.preferences.v1';

export type Timeframe = '7d' | '30d' | 'month' | '3m' | '6m' | 'year';

export const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: 'year', label: 'This year' },
];

/** Analytics cards the user can switch on and off, in display order. */
export const INSIGHT_CARDS = [
  { key: 'summary', label: 'Summary' },
  { key: 'trend', label: 'Spending over time' },
  { key: 'categories', label: 'By category' },
  { key: 'months', label: 'Month comparison' },
  { key: 'accounts', label: 'Account split' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'top', label: 'Most frequent' },
] as const;

export type InsightCard = (typeof INSIGHT_CARDS)[number]['key'];

export type Preferences = {
  themeMode: ThemeMode;
  currency: string;
  /** Pre-selected account on the entry screen; null means "first account". */
  defaultAccountId: string | null;
  haptics: boolean;
  /** Default timeframe for the deltas on the overview and the insights screen. */
  timeframe: Timeframe;
  /** Which insight cards are visible, in the order above. */
  cards: InsightCard[];
  /** Show running account balances on transaction rows. */
  showRunningBalance: boolean;
  /** Group the transaction list by day with per-day totals. */
  groupByDay: boolean;
};

const DEFAULTS: Preferences = {
  themeMode: 'system',
  currency: 'CHF',
  defaultAccountId: null,
  haptics: true,
  timeframe: '30d',
  cards: ['summary', 'trend', 'categories', 'months', 'accounts', 'budgets', 'top'],
  showRunningBalance: false,
  groupByDay: true,
};

type Ctx = {
  prefs: Preferences;
  ready: boolean;
  theme: Theme;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
  /** Fires a selection tick unless the user turned haptics off. */
  tick: () => void;
};

const PreferencesContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        // Merge rather than replace, so preferences added in a later version get
        // their defaults instead of coming back undefined.
        if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) });
      } catch {
        // A corrupt blob should not stop the app from opening; defaults are fine.
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: Preferences) => {
    setPrefs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const set = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((current) => {
        const next = { ...current, [key]: value };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => persist(DEFAULTS), [persist]);

  const theme = useMemo(
    () => resolveTheme(prefs.themeMode, systemScheme),
    [prefs.themeMode, systemScheme],
  );

  const tick = useCallback(() => {
    if (prefs.haptics) Haptics.selectionAsync().catch(() => {});
  }, [prefs.haptics]);

  const value = useMemo<Ctx>(
    () => ({ prefs, ready, theme, set, reset, tick }),
    [prefs, ready, theme, set, reset, tick],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Ctx {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}

/** The themed palette, honouring the user's appearance choice. */
export const useTheme = (): Theme => usePreferences().theme;
