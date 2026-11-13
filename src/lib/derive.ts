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
