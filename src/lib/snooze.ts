import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Snoozed "Needs you" items, per device. An item id maps to the ISO time it may show again.
 * Expired entries are dropped on load so the blob never grows.
 */

const KEY = 'sumry.snooze.v1';

type Snoozes = Record<string, string>;

/** Pure filter: the items whose snooze has run out (or never existed). */
export function unsnoozed<T extends { id: string }>(items: T[], snoozes: Snoozes, now = new Date()): T[] {
  return items.filter((it) => {
    const until = snoozes[it.id];
    return !until || new Date(until).getTime() <= now.getTime();
  });
}

export function useSnoozes() {
  const [snoozes, setSnoozes] = useState<Snoozes>({});

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Snoozes;
        const now = Date.now();
        const live: Snoozes = {};
        for (const [k, v] of Object.entries(parsed)) if (new Date(v).getTime() > now) live[k] = v;
        setSnoozes(live);
      })
      .catch(() => {});
  }, []);

  const write = useCallback((next: Snoozes) => {
    setSnoozes(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  /** Hides the item until the start of the day `days` from now. */
  const snooze = useCallback(
    (id: string, days = 1) => {
      const until = new Date();
      until.setHours(0, 0, 0, 0);
      until.setDate(until.getDate() + days);
      write({ ...snoozes, [id]: until.toISOString() });
    },
    [snoozes, write],
  );

  const clear = useCallback(() => write({}), [write]);

  return { snoozes, snooze, clear };
}
