import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { Sparkline } from '../../src/components/charts';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Btn, Card, Divider, Empty, Field, Header, Hint, KV, Section, Segment, ui } from '../../src/components/ui';
import { SwitchRow } from '../../src/components/Rows';
import { useToast } from '../../src/components/Toast';
import { useDestructiveAction } from '../../src/components/ConfirmDialog';
import { useApp } from '../../src/store';
import { useDeleteTransaction } from '../../src/actions';
import {
  balanceSeries,
  formatAmount,
  formatShortDate,
  projectBalance,
  resolveRange,
  type Cashflow,
  type Timeframe,
} from '../../src/core';
import { api } from '../../src/api';
import { daysSince, shortDay } from '../../src/lib/dates';
import { usePreferences, useTheme } from '../../src/preferences';
import { space, type } from '../../src/theme';

const SPANS: [Timeframe, string][] = [
  ['30d', '30 d'],
  ['3m', '3 m'],
  ['6m', '6 m'],
  ['year', 'Year'],
];

/**
 * One account: balance over time, this month's in and out, the next two weeks, when it was
 * last checked against the bank (and a field to do that now), whether it counts toward safe
 * to spend, and its recent entries.
 */
export default function AccountDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, reconcile: openReconcile } = useLocalSearchParams<{ id: string; reconcile?: string }>();
  const { accounts, categories, transactions, upcoming, token, mutate, refreshing, refresh } = useApp();
  const { prefs, mask } = usePreferences();
  const toast = useToast();
  const destructive = useDestructiveAction();
  const deleteTransaction = useDeleteTransaction();

  const account = accounts.find((a) => a.id === id);
  const [span, setSpan] = useState<Timeframe>('3m');
  const [cashflow, setCashflow] = useState<Cashflow | null>(null);
  const [bankSays, setBankSays] = useState(openReconcile ? String((account?.currentBalance ?? 0).toFixed(2)) : '');
  const [reconciling, setReconciling] = useState(!!openReconcile);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(account?.accountName ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    api.cashflow(token, id).then(setCashflow).catch(() => setCashflow(null));
  }, [token, id, transactions]);

  const own = useMemo(() => transactions.filter((t) => t.userAccountId === id), [transactions, id]);
  const range = useMemo(() => resolveRange(span), [span]);
  const series = useMemo(() => (account ? balanceSeries([account], own, range) : []), [account, own, range]);
  const projection = useMemo(() => (account ? projectBalance([account], upcoming, 14) : null), [account, upcoming]);
  const recent = useMemo(() => [...own].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15), [own]);
  const categoryByLabel = useMemo(() => new Map(categories.map((c) => [c.label, c])), [categories]);
  const next = useMemo(() => upcoming.filter((o) => o.accountId === id).slice(0, 5), [upcoming, id]);

  if (!account) {
    return (
      <Screen>
        <Header title="Account" />
        <Empty text="This account no longer exists." />
      </Screen>
    );
  }

  const target = Number.parseFloat(bankSays.replace(',', '.').replace(/'/g, ''));
  const diff = Number.isFinite(target) ? target - account.currentBalance : null;
  const since = daysSince(account.lastReconciledAt);
  const lo = series.reduce((m, p) => Math.min(m, p.value), Infinity);
  const hi = series.reduce((m, p) => Math.max(m, p.value), -Infinity);

  const doReconcile = async () => {
    if (diff === null) return;
    setBusy(true);
    try {
      await mutate((t) => api.reconcileAccount(t, account.id, target, 'Abgleich'));
      setReconciling(false);
      setBankSays('');
      if (Math.abs(diff) < 0.005) toast.success('Checked', 'The balance already matched. Nothing was booked.');
      else toast.success('Account adjusted', `Booked ${diff > 0 ? '+' : '−'}${formatAmount(diff)} as an "Einstellung" entry.`);
    } catch (e) {
      toast.error('Could not adjust', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    if (!name.trim()) return;
    try {
      await mutate((t) => api.updateAccount(t, account.id, { accountName: name.trim() }));
      setRenaming(false);
    } catch (e) {
      toast.error('Could not rename', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <Screen>
      <Header
        title={account.accountName}
        subtitle={account.spending !== false ? 'counts toward safe to spend' : 'savings · not in safe to spend'}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
      >
        <View style={{ paddingHorizontal: space.xl }}>
          <Text style={[type.caption, { color: theme.textFaint }]}>BALANCE</Text>
          <Text style={[type.display, { color: account.currentBalance < 0 ? theme.negative : theme.text, marginTop: 2 }]}>
            {account.currentBalance < 0 ? '−' : ''}
            {mask(formatAmount(account.currentBalance))}
            <Text style={[type.label, { color: theme.textFaint }]}> {account.currency}</Text>
          </Text>
          {account.currency !== account.baseCurrency ? (
            <Text style={[type.label, { color: theme.textFaint }]}>
              ≈ {mask(formatAmount(account.baseBalance))} {account.baseCurrency}
            </Text>
          ) : null}
        </View>

        <Card style={{ marginTop: space.lg }}>
          <Segment<Timeframe> options={SPANS} value={span} onChange={setSpan} />
          <View style={{ marginTop: space.md }}>
            <Sparkline values={series.map((p) => p.value)} color={theme.text} height={90} />
          </View>
          {series.length ? (
            <View style={[ui.between, { marginTop: space.xs }]}>
              <Text style={[type.caption, { color: theme.textFaint }]}>{series[0].label}</Text>
              <Text style={[type.caption, { color: theme.textFaint }]}>
                low {mask(formatAmount(lo))} · high {mask(formatAmount(hi))}
              </Text>
            </View>
          ) : null}
        </Card>

        <Section title="This month" />
        <Card>
          <KV label="In" value={`+${mask(formatAmount(cashflow?.income ?? 0), 'all')}`} color={theme.positive} />
          <KV label="Out" value={`−${mask(formatAmount(cashflow?.expenses ?? 0), 'all')}`} color={theme.negative} />
          <KV
            label="Cash flow"
            strong
            value={`${(cashflow?.income ?? 0) - (cashflow?.expenses ?? 0) < 0 ? '−' : '+'}${mask(formatAmount((cashflow?.income ?? 0) - (cashflow?.expenses ?? 0)), 'all')}`}
          />
        </Card>

        {projection ? (
          <>
            <Section title="Next 14 days" detail={`${next.length} planned`} />
            <Card>
              <Sparkline values={projection.points.map((p) => p.balance)} color={theme.textMuted} height={44} />
              <View style={[ui.between, { marginTop: space.xs }]}>
                <Text style={[type.caption, { color: theme.textFaint }]}>today {mask(formatAmount(projection.start))}</Text>
                <Text style={[type.caption, { color: projection.lowest.balance < 0 ? theme.negative : theme.textFaint }]}>
                  lowest {mask(formatAmount(projection.lowest.balance))} on {formatShortDate(projection.lowest.date)}
                </Text>
              </View>
              {next.map((o) => (
                <KV
                  key={`${o.plannedId}-${o.date}`}
                  label={`${formatShortDate(o.date)} · ${o.name}`}
                  value={`${o.kind === 'INCOME' ? '+' : '−'}${mask(formatAmount(o.amount), 'all')}`}
                  onPress={() => router.push(`/planned/${o.plannedId}`)}
                />
              ))}
            </Card>
          </>
        ) : null}

        <Section
          title="Checked against the bank"
          detail={account.lastReconciledAt ? `${shortDay(account.lastReconciledAt)} · ${since} d ago` : account.lastReconciledAt === null ? 'never' : undefined}
          detailColor={since === null || since >= 14 ? theme.accent : undefined}
        />
        <Card>
          {reconciling ? (
            <View style={{ gap: space.sm }}>
              <Text style={[type.label, { color: theme.textMuted }]}>My bank says</Text>
              <Field value={bankSays} onChangeText={setBankSays} placeholder={formatAmount(account.currentBalance)} keyboardType="decimal-pad" autoFocus />
              {diff !== null ? (
                <Text style={[type.label, { color: Math.abs(diff) < 0.005 ? theme.positive : theme.textMuted }]}>
                  {Math.abs(diff) < 0.005 ? 'Matches. Saving marks it as checked.' : `Difference ${diff > 0 ? '+' : '−'}${formatAmount(diff)}, booked as an "Einstellung" entry.`}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Btn label="Cancel" onPress={() => setReconciling(false)} style={{ flex: 1 }} />
                <Btn primary label={busy ? 'Saving…' : 'Save'} disabled={diff === null || busy} onPress={doReconcile} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={ui.between}>
              <Text style={[type.label, { color: theme.textMuted, flex: 1 }]}>
                Does {mask(formatAmount(account.currentBalance))} match your bank or wallet?
              </Text>
              <Btn
                small
                primary
                label="Check"
                onPress={() => {
                  setBankSays(account.currentBalance.toFixed(2));
                  setReconciling(true);
                }}
              />
            </View>
          )}
        </Card>

        <Section title="Settings" />
        <Card padded={false}>
          <SwitchRow
            icon="wallet-outline"
            label="Counts toward safe to spend"
            hint="Turn off for savings like Sparkonto"
            value={account.spending !== false}
            onChange={(v) =>
              mutate((t) => api.updateAccount(t, account.id, { spending: v })).catch((e) =>
                toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error'),
              )
            }
          />
          <Divider />
          {renaming ? (
            <View style={{ padding: space.lg, gap: space.sm }}>
              <Field value={name} onChangeText={setName} placeholder="Account name" autoFocus />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Btn label="Cancel" onPress={() => setRenaming(false)} style={{ flex: 1 }} />
                <Btn primary label="Rename" onPress={rename} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={[ui.row, { gap: space.sm }]}>
              <Btn small icon="create-outline" label="Rename" onPress={() => setRenaming(true)} />
              <Btn small icon="cloud-upload-outline" label="Import statement" onPress={() => router.push({ pathname: '/import', params: { account: account.id } })} />
              <Btn
                small
                danger
                icon="trash-outline"
                label="Delete"
                onPress={() =>
                  void destructive(
                    { title: `Delete ${account.accountName}?`, message: 'The account and every entry on it are removed. This cannot be undone.' },
                    () => mutate((t) => api.deleteAccount(t, account.id)),
                    {
                      onSuccess: () => {
                        toast.success('Account deleted', account.accountName);
                        router.back();
                      },
                      onError: (m) => toast.error('Could not delete', m),
                    },
                  )
                }
              />
            </View>
          )}
        </Card>

        <Section
          title="Recent entries"
          detail={`${own.length} in total`}
          action="All →"
          onAction={() => router.push({ pathname: '/activity', params: { account: account.id } })}
        />
        <Card padded={false}>
          {recent.map((tx, i) => (
            <View key={tx.id}>
              {i > 0 ? <Divider inset={64} /> : null}
              <TransactionRow
                tx={tx}
                category={categoryByLabel.get(tx.categoryLabel ?? '')}
                showDate
                onPress={() => router.push({ pathname: '/entry', params: { id: tx.id } })}
                onDelete={() => deleteTransaction(tx)}
              />
            </View>
          ))}
          {recent.length === 0 ? <Empty text="No entries on this account yet." /> : null}
        </Card>
        <Hint text={`Amounts in ${account.currency}. ${prefs.privacy !== 'off' ? 'Tap the eye on Today to show hidden figures.' : ''}`} />
      </ScrollView>
    </Screen>
  );
}
