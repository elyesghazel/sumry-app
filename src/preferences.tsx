import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';
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

/**
 * How much of the money is hidden when someone else can see the screen.
 * `balances` covers the figures that reveal how much you have; `all` also masks the
 * individual amounts in lists.
 */
export type PrivacyMode = 'off' | 'balances' | 'all';

export type Preferences = {
  themeMode: ThemeMode;
  privacy: PrivacyMode;
  /** Require a device unlock (biometric or passcode) before the app can be used. */
  appLock: boolean;
  /** Seconds in the background before it locks again. 0 locks every time. */
  lockDelaySeconds: number;
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
  privacy: 'off',
  appLock: false,
  lockDelaySeconds: 60,
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

  /** True while figures are hidden — i.e. privacy is on and nothing is revealed. */
  hidden: boolean;
  /** Momentarily show the real figures. Resets when the app leaves the foreground. */
  reveal: () => void;
  /** Formats an amount, or returns a mask when it should not be on screen. */
  mask: (formatted: string, level?: 'balances' | 'all') => string;

  /** Applies preferences fetched from the server without echoing them back. */
  applyRemote: (remote: Partial<Preferences>) => void;
  /** Registers the uploader used for account-level settings. */
  registerSync: (fn: SyncFn | null) => void;
};

/** Uploads the account-level subset. Registered by the data store, which holds the token. */
export type SyncFn = (patch: Record<string, unknown>) => Promise<unknown>;

/**
 * Settings that live on the account rather than the device, so a reinstall or a second
 * device inherits them. Everything else — haptics, which cards are shown — describes the
 * phone in your hand and stays local.
 */
const SERVER_BACKED: Partial<Record<keyof Preferences, string>> = {
  themeMode: 'theme',
  privacy: 'privacy',
  currency: 'preferredCurrency',
  timeframe: 'timeframe',
  appLock: 'appLock',
  lockDelaySeconds: 'lockDelaySeconds',
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

  // Held in a ref so registering the uploader never re-renders every consumer.
  const syncRef = React.useRef<SyncFn | null>(null);
  const registerSync = useCallback((fn: SyncFn | null) => {
    syncRef.current = fn;
  }, []);

  const set = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((current) => {
        const next = { ...current, [key]: value };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });

      const field = SERVER_BACKED[key];
      // Fire and forget: the local write already happened, so a failed upload costs
      // the sync, not the setting.
      if (field && syncRef.current) {
        syncRef.current({ [field]: value }).catch(() => {});
      }
    },
    [],
  );

  const applyRemote = useCallback((remote: Partial<Preferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...remote };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => persist(DEFAULTS), [persist]);

  const theme = useMemo(
    () => resolveTheme(prefs.themeMode, systemScheme),
    [prefs.themeMode, systemScheme],
  );

  const tick = useCallback(() => {
    if (prefs.haptics) Haptics.selectionAsync().catch(() => {});
  }, [prefs.haptics]);

  // Revealing is deliberately not persisted: putting the phone down and picking it up
  // again should never leave the balance showing.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRevealed(false);
    });
    return () => sub.remove();
  }, [revealed]);

  const hidden = prefs.privacy !== 'off' && !revealed;

  const reveal = useCallback(() => setRevealed((r) => !r), []);

  const mask = useCallback(
    (formatted: string, level: 'balances' | 'all' = 'balances') => {
      if (!hidden) return formatted;
      // 'all' figures stay visible when only balances are hidden.
      if (level === 'all' && prefs.privacy !== 'all') return formatted;
      return '•'.repeat(Math.max(3, Math.min(6, formatted.replace(/[^0-9]/g, '').length)));
    },
    [hidden, prefs.privacy],
  );

  const value = useMemo<Ctx>(
    () => ({ prefs, ready, theme, set, reset, tick, hidden, reveal, mask, applyRemote, registerSync }),
    [prefs, ready, theme, set, reset, tick, hidden, reveal, mask, applyRemote, registerSync],
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
