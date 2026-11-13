import { isoDay, relativeDays } from '../core';

/**
 * Date helpers for ISO days (`YYYY-MM-DD`) that the screens share. Pure; candidates for
 * the shared core.
 */

export const todayIso = (): string => isoDay(new Date());

/** `iso` moved by `days` calendar days, still an ISO day. */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Same day next month, clamped to the month's last day. */
export function shiftMonthIso(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m - 1 + months, Math.min(d, last)));
  return t.toISOString().slice(0, 10);
}

/** "TODAY", "TOMORROW", "FRI 23" within the week, "23 NOV" beyond it. */
export function dayLabel(iso: string): string {
  const rel = relativeDays(iso);
  if (rel === 'today' || rel === 'tomorrow' || rel === 'yesterday') return rel.toUpperCase();
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const diff = d.getTime() - Date.now();
  const withinWeek = diff > -6 * 86_400_000 && diff < 6 * 86_400_000;
  return d
    .toLocaleDateString('en-GB', withinWeek ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' })
    .toUpperCase();
}

/** "Friday, 13 November". */
export const longToday = (now = new Date()): string =>
  now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

/** "13 Nov 2026" for an ISO day or datetime. */
export const shortDay = (iso: string): string =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** `YYYY-MM` of a date. */
export const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** "November 2026" from `YYYY-MM`. */
export const monthTitle = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export const shiftMonthKey = (key: string, n: number): string => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};

/** Whole days from the ISO datetime to now; null for null. */
export const daysSince = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
};
