import { useCallback } from 'react';
import { Transaction, formatAmount, isTransfer } from './core';
import { api } from './api';
import { useApp } from './store';
import { usePreferences } from './preferences';
import { useToast } from './components/Toast';
import { useDestructiveAction } from './components/ConfirmDialog';
import { dayLabel, shiftIso, todayIso } from './lib/dates';

/**
 * Deleting a transaction from a list: confirm, delete both legs if it is a transfer,
 * then say so. Shared by every surface that shows a row, so the wording and the
 * confirmation stay identical wherever you swipe.
 */
export function useDeleteTransaction() {
  const { mutate } = useApp();
  const { prefs } = usePreferences();
  const toast = useToast();
  const run = useDestructiveAction();

  return useCallback(
    (tx: Transaction) => {
      const transfer = isTransfer(tx.kind);
      const label = transfer ? 'Transfer' : (tx.categoryLabel ?? 'Transaction');
      const money = `${prefs.currency} ${formatAmount(tx.amount)}`;

      return run(
        {
          title: 'Delete this transaction?',
          message: transfer
            ? `${money} · both sides of this transfer will be removed.`
            : `${label} · ${money}. This cannot be undone.`,
          confirmLabel: 'Delete',
        },
        () =>
          transfer && tx.transferGroupId
            ? mutate((t) => api.deleteTransfer(t, tx.transferGroupId!))
            : mutate((t) => api.deleteTransaction(t, tx.id)),
        {
          onSuccess: () => toast.success('Transaction deleted', `${label} · ${money}`),
          onError: (message) => toast.error('Could not delete', message),
        },
      );
    },
    [mutate, prefs.currency, run, toast],
  );
}

/**
 * Book, skip and postpone for a planned occurrence, with the toast and haptic each needs.
 * Today's inbox, the Plan tab and the planned detail all call these.
 */
export function usePlanActions() {
  const { mutate } = useApp();
  const { tick } = usePreferences();
  const toast = useToast();

  const fail = (what: string) => (e: unknown) =>
    toast.error(`Could not ${what}`, e instanceof Error ? e.message : 'Unknown error');

  const book = useCallback(
    async (o: { plannedId: string; name: string }) => {
      tick();
      try {
        await mutate((t) => api.bookPlanned(t, o.plannedId));
        toast.success('Booked', o.name);
        return true;
      } catch (e) {
        fail('book')(e);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate, tick, toast],
  );

  const skip = useCallback(
    async (o: { plannedId: string; name: string; date: string }) => {
      tick();
      try {
        await mutate((t) => api.skipPlanned(t, o.plannedId, o.date.slice(0, 10)));
        toast.success('Skipped', o.name);
        return true;
      } catch (e) {
        fail('skip')(e);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate, tick, toast],
  );

  /** Moves the occurrence by `days`, never into the past. */
  const postpone = useCallback(
    async (o: { plannedId: string; name: string; date: string }, days: number) => {
      tick();
      const today = todayIso();
      const base = o.date.slice(0, 10) < today ? today : o.date.slice(0, 10);
      const to = shiftIso(base, days);
      try {
        await mutate((t) => api.postponePlanned(t, o.plannedId, o.date.slice(0, 10), to));
        toast.success('Moved', `${o.name} → ${dayLabel(to).toLowerCase()}`);
        return true;
      } catch (e) {
        fail('move')(e);
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutate, tick, toast],
  );

  return { book, skip, postpone };
}
