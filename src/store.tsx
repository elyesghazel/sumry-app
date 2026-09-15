import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { usePreferences } from './preferences';
import {
  Account,
  ApiError,
  Budget,
  BudgetProgress,
  Category,
  Forecast,
  Goal,
  Me,
  Occurrence,
  Planned,
  SafeToSpend,
  Subscriptions,
  Transaction,
  api,
} from './api';

const TOKEN_KEY = 'sumry.token';

type Status = 'loading' | 'signed-out' | 'signed-in';

type Ctx = {
  status: Status;
  user: Me | null;
  token: string | null;

  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  progress: BudgetProgress[];
  planned: Planned[];
  upcoming: Occurrence[];
  safe: SafeToSpend | null;
  goals: Goal[];
  forecast: Forecast | null;
  subscriptions: Subscriptions | null;

  refreshing: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  /** Ends this session on the server too; `everywhere` invalidates every device. */
  signOut: (everywhere?: boolean) => Promise<void>;
  /** Swaps the stored token, e.g. after a password change hands back a new one. */
  adoptToken: (token: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** Runs an authenticated call, then re-reads everything the change could have touched. */
  mutate: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // AppProvider sits inside PreferencesProvider, so it can hand the token-bearing
  // uploader down to it and push account-level settings on change.
  const { applyRemote, registerSync } = usePreferences();
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [progress, setProgress] = useState<BudgetProgress[]>([]);
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [upcoming, setUpcoming] = useState<Occurrence[]>([]);
  const [safe, setSafe] = useState<SafeToSpend | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscriptions | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setToken(null);
    setUser(null);
    setAccounts([]);
    setCategories([]);
    setTransactions([]);
    setBudgets([]);
    setProgress([]);
    setPlanned([]);
    setUpcoming([]);
    setSafe(null);
    setGoals([]);
    setForecast(null);
    setSubscriptions(null);
    setStatus('signed-out');
  }, []);

  const loadAll = useCallback(
    async (t: string) => {
      setRefreshing(true);
      try {
        const [acc, cat, tx, bud, prog, remote, plan, up, sts, gls, fc, subs] = await Promise.all([
          api.accounts(t),
          api.categories(t),
          api.transactions(t),
          api.budgets(t),
          api.budgetProgress(t),
          // Everything below is nice-to-have: a failure there must not blank the dashboard.
          api.preferences(t).catch(() => null),
          api.planned(t).catch(() => [] as Planned[]),
          api.upcoming(t).catch(() => [] as Occurrence[]),
          api.safeToSpend(t).catch(() => null),
          api.goals(t).catch(() => [] as Goal[]),
          api.forecast(t).catch(() => null),
          api.subscriptions(t).catch(() => null),
        ]);
        setAccounts(acc);
        setCategories(cat.filter((c) => c.isActive !== false));
        setTransactions(tx);
        setBudgets(bud);
        setProgress(prog);
        setPlanned(plan);
        setUpcoming(up);
        setSafe(sts);
        setGoals(gls);
        setForecast(fc);
        setSubscriptions(subs);
        if (remote) {
          applyRemote({
            themeMode: remote.theme as never,
            privacy: remote.privacy as never,
            currency: remote.preferredCurrency,
            timeframe: remote.timeframe as never,
            appLock: remote.appLock,
            lockDelaySeconds: remote.lockDelaySeconds,
          });
        }
        setError(null);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await clearSession();
          return;
        }
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setRefreshing(false);
      }
    },
    [clearSession, applyRemote],
  );

  // Keep the uploader in step with the current token.
  useEffect(() => {
    registerSync(token ? (patch) => api.updatePreferences(token, patch) : null);
    return () => registerSync(null);
  }, [token, registerSync]);

  // Restore a stored session on cold start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!stored) {
        if (!cancelled) setStatus('signed-out');
        return;
      }
      try {
        const me = await api.me(stored);
        if (cancelled) return;
        setToken(stored);
        setUser(me);
        setStatus('signed-in');
        await loadAll(stored);
      } catch {
        if (!cancelled) await clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll, clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token: t } = await api.login(email.trim(), password);
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      const me = await api.me(t);
      setToken(t);
      setUser(me);
      setStatus('signed-in');
      await loadAll(t);
    },
    [loadAll],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await api.register(username.trim(), email.trim(), password);
      await signIn(email, password);
    },
    [signIn],
  );

  const refresh = useCallback(async () => {
    if (token) await loadAll(token);
  }, [token, loadAll]);

  const signOut = useCallback(
    async (everywhere = false) => {
      if (token) {
        // Best effort: the local token is dropped whatever the server says.
        await (everywhere ? api.logoutEverywhere(token) : api.logout(token)).catch(() => {});
      }
      await clearSession();
    },
    [token, clearSession],
  );

  const adoptToken = useCallback(async (t: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    setToken(t);
  }, []);

  const mutate = useCallback(
    async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
      if (!token) throw new ApiError(401, 'Not signed in');
      const result = await fn(token);
      await loadAll(token);
      return result;
    },
    [token, loadAll],
  );

  const value = useMemo<Ctx>(
    () => ({
      status,
      user,
      token,
      accounts,
      categories,
      transactions,
      budgets,
      progress,
      planned,
      upcoming,
      safe,
      goals,
      forecast,
      subscriptions,
      refreshing,
      error,
      signIn,
      register,
      signOut,
      adoptToken,
      refresh,
      mutate,
    }),
    [
      status,
      user,
      token,
      accounts,
      categories,
      transactions,
      budgets,
      progress,
      planned,
      upcoming,
      safe,
      goals,
      forecast,
      subscriptions,
      refreshing,
      error,
      signIn,
      register,
      signOut,
      adoptToken,
      refresh,
      mutate,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
