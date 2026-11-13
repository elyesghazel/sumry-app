import { useCallback } from 'react';
import { Transaction, formatAmount, isTransfer } from './core';
import { api } from './api';
import { useApp } from './store';
import { usePreferences } from './preferences';
import { useToast } from './components/Toast';
import { useDestructiveAction } from './components/ConfirmDialog';

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
