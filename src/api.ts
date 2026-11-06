import Constants from 'expo-constants';

/**
 * Thin typed client for the Sumry backend.
 *
 * The base URL comes from EXPO_PUBLIC_API_URL so the same JS bundle can point at a local
 * backend during development and at the deployed one in a release build.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'https://sumry.elyesghazel.ch';

export type CategoryType = 'INCOME' | 'EXPENSE';
export type TransactionKind = 'INCOME' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export type Account = {
  id: string;
  userId: string | null;
  accountName: string;
  currentBalance: number;
  currency: string;
  /** Counts toward safe-to-spend; off for savings. */
  spending: boolean;
  /** The balance in the user's base currency at today's rate. */
  baseBalance: number;
  baseCurrency: string;
};

export type Category = {
  id: string;
  label: string;
  parentGroup: string | null;
  color: string | null;
  icon: string | null;
  categoryType: CategoryType;
  isActive: boolean | null;
  userId: string | null;
};

export type Transaction = {
  id: string;
  amount: number;
  description: string | null;
  categoryId: string | null;
  categoryLabel: string | null;
  kind: TransactionKind;
  transferGroupId: string | null;
  date: string;
  userAccountId: string | null;
  userId: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  currency: string;
  fxRate: number;
  /** The amount in the user's base currency — what reports add up. */
  baseAmount: number;
};

export type BudgetPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type Budget = {
  id: string;
  limitAmount: number;
  categoryLabel: string;
  categoryColor: string | null;
  period: BudgetPeriod;
  rollover: boolean;
  startDay: number;
};

export type BudgetProgress = {
  budgetId: string;
  categoryLabel: string;
  categoryColor: string | null;
  limitAmount: number;
  spentAmount: number;
  remaining: number;
  percentage: number;
  period: BudgetPeriod;
  periodStart: string;
  periodEnd: string;
  daysLeft: number;
  rollover: boolean;
  carry: number;
  effectiveLimit: number;
  pace: 'under' | 'on' | 'over';
  perDayLeft: number;
};

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ONCE';

export type Planned = {
  id: string;
  name: string;
  amount: number;
  description: string | null;
  startDate: string;
  endDate: string | null;
  frequency: Frequency;
  kind: TransactionKind;
  categoryLabel: string | null;
  categoryColor: string | null;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  autoBook: boolean;
  isActive: boolean;
  lastBookedOn: string | null;
  nextDate: string | null;
  monthlyEquivalent: number;
};

export type Occurrence = {
  plannedId: string;
  name: string;
  amount: number;
  kind: TransactionKind;
  date: string;
  categoryLabel: string | null;
  categoryColor: string | null;
  accountId: string;
  accountName: string;
  currency: string;
  toAccountName: string | null;
  autoBook: boolean;
  overdue: boolean;
};

export type SafeToSpend = {
  balance: number;
  accountId: string | null;
  today: string;
  horizon: string;
  daysToHorizon: number;
  horizonReason: string;
  upcomingExpenses: number;
  upcomingTransfersOut: number;
  safeToSpend: number;
  perDay: number;
  upcoming: Occurrence[];
};

export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  accountId: string | null;
  accountName: string | null;
  current: number;
  remaining: number;
  percentage: number;
  monthsLeft: number | null;
  requiredPerMonth: number | null;
  onTrack: boolean | null;
  achieved: boolean;
  color: string | null;
  icon: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Subscription = {
  name: string;
  interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  medianAmount: number;
  monthlyEquivalent: number;
  occurrences: number;
  lastDate: string;
  nextExpected: string;
  active: boolean;
  categoryLabel: string | null;
  categoryColor: string | null;
  accountId: string | null;
  accountName: string | null;
  planned: boolean;
};

export type Subscriptions = {
  subscriptions: Subscription[];
  activeCount: number;
  monthlyTotal: number;
  yearlyTotal: number;
};

export type Forecast = {
  monthStart: string;
  monthEnd: string;
  today: string;
  daysElapsed: number;
  daysLeft: number;
  spentSoFar: number;
  incomeSoFar: number;
  plannedExpensesRemaining: number;
  plannedIncomeRemaining: number;
  baselineDailyPace: number;
  currentDailyPace: number;
  projectedSpend: number;
  projectedIncome: number;
  projectedNet: number;
  lastMonthSpend: number;
  sameMonthLastYearSpend: number;
  verdict: 'under' | 'on' | 'over';
};

export type QuickEntry = {
  parsed: {
    amount: number | null;
    description: string;
    date: string;
    kind: TransactionKind;
    accountId: string | null;
    accountName: string | null;
    toAccountId: string | null;
    toAccountName: string | null;
    categoryLabel: string | null;
    categoryColor: string | null;
    categorySource: 'explicit' | 'rule' | null;
  };
  missing: string[];
  ready: boolean;
  booked: Transaction | null;
  transferGroupId: string | null;
};

export type Me = { id: string; username: string; email: string };

export type ServerPreferences = {
  preferredCurrency: string;
  theme: string;
  language: string;
  privacy: string;
  appLock: boolean;
  lockDelaySeconds: number;
  timeframe: string;
};

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Pulls the most useful line out of the backend's several error shapes. */
function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.message === 'string') return b.message;
    if (Array.isArray(b.validationErrors)) {
      const first = b.validationErrors[0] as { message?: string } | undefined;
      if (first?.message) return first.message;
    }
    if (typeof b.error === 'string') return b.error;
  }
  if (status === 401) return 'Session expired. Please sign in again.';
  return `Request failed (${status})`;
}

type Options = { token?: string | null; body?: unknown; method?: string };

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { token, body, method = body === undefined ? 'GET' : 'POST' } = opts;

  const res = await fetch(API_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) throw new ApiError(res.status, messageFrom(res.status, parsed));
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; email: string }>('/api/users/login', { body: { email, password } }),

  register: (username: string, email: string, password: string) =>
    request<Me>('/api/users/register', { body: { username, email, password } }),

  me: (token: string) => request<Me>('/api/users/validate', { token }),

  preferences: (token: string) => request<ServerPreferences>('/api/users/preferences', { token }),

  updatePreferences: (token: string, patch: Record<string, unknown>) =>
    request<ServerPreferences>('/api/users/preferences', { token, body: patch, method: 'PUT' }),

  accounts: (token: string) => request<Account[]>('/api/users/accounts/', { token }),

  createAccount: (token: string, accountName: string, currentBalance: number, currency = 'CHF') =>
    request<Account>('/api/users/accounts', { token, body: { accountName, currentBalance, currency } }),

  updateAccount: (token: string, id: string, patch: { accountName?: string; currentBalance?: number; currency?: string; spending?: boolean }) =>
    request<Account>(`/api/users/accounts/${id}`, { token, body: patch, method: 'PUT' }),

  deleteAccount: (token: string, id: string) =>
    request<void>(`/api/users/accounts/${id}`, { token, method: 'DELETE' }),

  reconcileAccount: (token: string, id: string, newBalance: number, note?: string | null) =>
    request<Transaction | null>(`/api/users/accounts/reconcile/${id}`, {
      token,
      body: { newBalance, note: note ?? null },
      method: 'PUT',
    }),

  /** Returns a fresh token: every other session is invalidated by the change. */
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ token: string; email: string }>('/api/users/password', {
      token,
      body: { currentPassword, newPassword },
      method: 'PUT',
    }),

  logout: (token: string) => request<void>('/api/users/logout', { token, method: 'POST', body: {} }),

  logoutEverywhere: (token: string) =>
    request<void>('/api/users/logout-all', { token, method: 'POST', body: {} }),

  categories: (token: string) => request<Category[]>('/api/category/user', { token }),

  // The backend identifies categories by label and takes it in the body, including on
  // DELETE, which is unusual but is the contract.
  deleteCategory: (token: string, label: string) =>
    request<void>('/api/category/label', { token, body: { label }, method: 'DELETE' }),

  createCategory: (
    token: string,
    input: {
      label: string;
      parentGroup?: string | null;
      color?: string | null;
      icon?: string | null;
      categoryType: CategoryType;
    },
  ) => request<Category>('/api/category/', { token, body: input }),

  updateCategory: (
    token: string,
    input: {
      label: string;
      newLabel?: string;
      parentGroup?: string | null;
      color?: string | null;
      icon?: string | null;
      categoryType?: CategoryType;
    },
  ) => request<Category>('/api/category/label', { token, body: input, method: 'PUT' }),

  transactions: (token: string) => request<Transaction[]>('/api/transactions/', { token }),

  createTransaction: (
    token: string,
    input: {
      amount: number;
      description?: string | null;
      categoryLabel: string;
      date: string;
      userAccountId: string;
    },
  ) => request<Transaction>('/api/transactions/', { token, body: input }),

  updateTransaction: (
    token: string,
    id: string,
    patch: {
      amount?: number;
      description?: string | null;
      categoryLabel?: string;
      date?: string;
      userAccountId?: string;
    },
  ) => request<Transaction>(`/api/transactions/${id}`, { token, body: patch, method: 'PUT' }),

  deleteTransaction: (token: string, id: string) =>
    request<void>(`/api/transactions/${id}`, { token, method: 'DELETE' }),

  createTransfer: (
    token: string,
    input: {
      amount: number;
      description?: string | null;
      fromAccountId: string;
      toAccountId: string;
      date: string;
    },
  ) => request<{ transferGroupId: string }>('/api/transactions/transfer', { token, body: input }),

  updateTransfer: (
    token: string,
    groupId: string,
    patch: {
      amount?: number;
      description?: string | null;
      fromAccountId?: string;
      toAccountId?: string;
      date?: string;
    },
  ) =>
    request<{ transferGroupId: string }>(`/api/transactions/transfer/${groupId}`, {
      token,
      body: patch,
      method: 'PUT',
    }),

  deleteTransfer: (token: string, groupId: string) =>
    request<void>(`/api/transactions/transfer/${groupId}`, { token, method: 'DELETE' }),

  budgets: (token: string) => request<Budget[]>('/api/budgets', { token }),

  /** Progress for the period containing today (or `date`, ISO day). */
  budgetProgress: (token: string, date?: string) =>
    request<BudgetProgress[]>(`/api/budgets/progress${date ? `?date=${date}` : ''}`, { token }),

  createBudget: (
    token: string,
    categoryLabel: string,
    maxAmount: number,
    extra: { period?: BudgetPeriod; rollover?: boolean; startDay?: number } = {},
  ) => request<Budget>('/api/budgets', { token, body: { categoryLabel, maxAmount, ...extra } }),

  updateBudget: (
    token: string,
    id: string,
    patch: { limitAmount?: number; period?: BudgetPeriod; rollover?: boolean; startDay?: number },
  ) => request<Budget>(`/api/budgets/${id}`, { token, body: patch, method: 'PUT' }),

  deleteBudget: (token: string, id: string) =>
    request<void>(`/api/budgets/${id}`, { token, method: 'DELETE' }),

  // ---- natural-language entry
  quick: (token: string, text: string, book: boolean) =>
    request<QuickEntry>('/api/transactions/quick', { token, body: { text, book } }),

  // ---- planned
  planned: (token: string) => request<Planned[]>('/api/planned', { token }),

  createPlanned: (
    token: string,
    input: {
      name: string; amount: number; startDate: string; frequency: Frequency;
      categoryLabel?: string | null; accountId: string; toAccountId?: string | null; autoBook?: boolean;
    },
  ) => request<Planned>('/api/planned', { token, body: input }),

  updatePlanned: (token: string, id: string, patch: { autoBook?: boolean; isActive?: boolean; amount?: number }) =>
    request<Planned>(`/api/planned/${id}`, { token, body: patch, method: 'PUT' }),

  deletePlanned: (token: string, id: string) =>
    request<void>(`/api/planned/${id}`, { token, method: 'DELETE' }),

  bookPlanned: (token: string, id: string) =>
    request<Planned>(`/api/planned/${id}/book`, { token, method: 'POST', body: {} }),

  /** A year-long token for Apple Shortcuts that only reaches /api/shortcut. */
  shortcutToken: (token: string) =>
    request<{ token: string; expiresAt: string }>('/api/users/shortcut-token', { token, method: 'POST', body: {} }),

  /** Lets the next occurrence pass unbooked; `date` must be that occurrence. */
  skipPlanned: (token: string, id: string, date: string) =>
    request<Planned>(`/api/planned/${id}/skip?date=${date}`, { token, method: 'POST', body: {} }),

  /** Moves the next occurrence to `to`; the move becomes a one-off plan on that date. */
  postponePlanned: (token: string, id: string, date: string, to: string) =>
    request<Planned>(`/api/planned/${id}/postpone?date=${date}&to=${to}`, { token, method: 'POST', body: {} }),

  upcoming: (token: string, days = 45) =>
    request<Occurrence[]>(`/api/planned/upcoming?days=${days}`, { token }),

  safeToSpend: (token: string) => request<SafeToSpend>('/api/planned/safe-to-spend', { token }),

  // ---- goals
  goals: (token: string) => request<Goal[]>('/api/goals', { token }),

  createGoal: (
    token: string,
    input: { name: string; targetAmount: number; targetDate?: string | null; accountId?: string | null; savedAmount?: number | null },
  ) => request<Goal>('/api/goals', { token, body: input }),

  deleteGoal: (token: string, id: string) => request<void>(`/api/goals/${id}`, { token, method: 'DELETE' }),

  contributeGoal: (token: string, id: string, amount: number, fromAccountId?: string | null) =>
    request<Goal>(`/api/goals/${id}/contribute`, { token, body: { amount, fromAccountId: fromAccountId ?? null } }),

  // ---- insights
  subscriptions: (token: string) => request<Subscriptions>('/api/insights/subscriptions', { token }),

  forecast: (token: string) => request<Forecast>('/api/insights/forecast', { token }),
};
