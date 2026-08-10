import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  Account,
  ApiError,
  Budget,
  BudgetProgress,
  Category,
  Me,
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

  refreshing: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Runs an authenticated call, then re-reads everything the change could have touched. */
  mutate: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Me | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [progress, setProgress] = useState<BudgetProgress[]>([]);

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
    setStatus('signed-out');
  }, []);

  const loadAll = useCallback(
    async (t: string) => {
      setRefreshing(true);
      const now = new Date();
      try {
        const [acc, cat, tx, bud, prog] = await Promise.all([
          api.accounts(t),
          api.categories(t),
          api.transactions(t),
          api.budgets(t),
          api.budgetProgress(t, now.getMonth() + 1, now.getFullYear()),
        ]);
        setAccounts(acc);
        setCategories(cat.filter((c) => c.isActive !== false));
        setTransactions(tx);
        setBudgets(bud);
        setProgress(prog);
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
    [clearSession],
  );

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
      refreshing,
      error,
      signIn,
      register,
      signOut: clearSession,
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
      refreshing,
      error,
      signIn,
      register,
      clearSession,
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
