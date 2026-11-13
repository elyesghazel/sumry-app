import { baseOf, isTransfer, type Transaction } from '../core';

/** Pure derivations the phone screens need beyond core/analytics. Candidates for core. */

export type MonthTotal = { key: string; label: string; value: number; count: number };

/** One category's total per calendar month, oldest first (expenses, or income for an income category). */
export function categoryMonths(transactions: Transaction[], label: string, months: number, now = new Date()): MonthTotal[] {
  const out: MonthTotal[] = [];
  const index = new Map<string, MonthTotal>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const p = { key, label: d.toLocaleDateString('en-GB', { month: 'short' }), value: 0, count: 0 };
    out.push(p);
    index.set(key, p);
  }
  for (const t of transactions) {
    if (isTransfer(t.kind) || (t.categoryLabel ?? 'Uncategorised') !== label) continue;
    const d = new Date(t.date);
    const p = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!p) continue;
    p.value += baseOf(t);
    p.count += 1;
  }
  return out;
}

export type DayBalance = { date: string; label: string; value: number };

/**
 * End-of-day balance of `accounts` for each of the last `days` days, rebuilt backwards
 * from today's balances in base currency, so it ends on the net worth Today shows. Daily points
 * keep a line smooth where balanceSeries switches to monthly buckets.
 */
export function dailyBalance(
  accounts: { id: string; currentBalance: number; baseBalance?: number | null }[],
  transactions: Transaction[],
  days: number,
  now = new Date(),
): DayBalance[] {
  const ids = new Set(accounts.map((a) => a.id));
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const delta = new Map<string, number>();
  for (const t of transactions) {
    if (!t.userAccountId || !ids.has(t.userAccountId)) continue;
    const k = keyOf(new Date(t.date));
    const sign = t.kind === 'INCOME' || t.kind === 'TRANSFER_IN' ? 1 : -1;
    delta.set(k, (delta.get(k) ?? 0) + sign * baseOf(t));
  }
  let running = accounts.reduce((s, a) => s + (a.baseBalance ?? a.currentBalance ?? 0), 0);
  const out: DayBalance[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const k = keyOf(d);
    out.push({ date: k, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: Math.round(running * 100) / 100 });
    running -= delta.get(k) ?? 0;
  }
  return out.reverse();
}
