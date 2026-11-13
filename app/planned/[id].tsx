import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Btn, Card, Divider, Empty, Field, Header, KV, Section, Segment } from '../../src/components/ui';
import { SwitchRow } from '../../src/components/Rows';
import { useToast } from '../../src/components/Toast';
import { useDestructiveAction } from '../../src/components/ConfirmDialog';
import { useApp } from '../../src/store';
import { usePlanActions } from '../../src/actions';
import { dayOf, formatAmount, relativeDays, type Frequency } from '../../src/core';
import { api } from '../../src/api';
import { shortDay, todayIso } from '../../src/lib/dates';
import { usePreferences, useTheme } from '../../src/preferences';
import { space, type } from '../../src/theme';

/** One planned item: what it is, when it comes next, and everything you can do to it. */
export default function PlannedDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { planned, upcoming, transactions, categories, mutate } = useApp();
  const { prefs, mask } = usePreferences();
  const toast = useToast();
  const destructive = useDestructiveAction();
  const actions = usePlanActions();

  const p = planned.find((x) => x.id === id);
  const next = useMemo(() => upcoming.filter((o) => o.plannedId === id), [upcoming, id]);
  // Past bookings: same name on the same account, newest first.
  const booked = useMemo(
    () =>
      p
        ? transactions
            .filter((t) => t.userAccountId === p.accountId && (t.description ?? '').toLowerCase() === p.name.toLowerCase())
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6)
        : [],
    [transactions, p],
  );

  const [name, setName] = useState(p?.name ?? '');
  const [amount, setAmount] = useState(p ? String(p.amount) : '');
  const [frequency, setFrequency] = useState<Frequency>(p?.frequency ?? 'MONTHLY');
  const [busy, setBusy] = useState(false);

  if (!p) {
    return (
      <Screen>
        <Header title="Planned" />
        <Empty text="This plan no longer exists." />
      </Screen>
    );
  }

  const first = next[0];
  const today = todayIso();
  const value = Number.parseFloat(amount.replace(',', '.'));
  const dirty = name.trim() !== p.name || value !== p.amount || frequency !== p.frequency;
  const sign = p.kind === 'INCOME' ? '+' : p.kind === 'TRANSFER_OUT' ? '' : '−';
  const category = categories.find((c) => c.label === p.categoryLabel);

  const save = async () => {
    if (!name.trim() || !(value > 0)) return;
    setBusy(true);
    try {
      await mutate((t) => api.updatePlanned(t, p.id, { name: name.trim(), amount: value, frequency }));
      toast.success('Plan saved', name.trim());
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={p.name} subtitle={`${p.frequency.toLowerCase()} · ${p.kind === 'TRANSFER_OUT' ? 'transfer' : p.kind.toLowerCase()}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: space.xl }}>
          <Text style={[type.display, { color: p.kind === 'INCOME' ? theme.positive : theme.text }]}>
            {sign}
            {mask(formatAmount(p.amount), 'all')}
            <Text style={[type.label, { color: theme.textFaint }]}> {prefs.currency}</Text>
          </Text>
          <Text style={[type.label, { color: first?.overdue ? theme.negative : theme.textMuted }]}>
            {first ? `${first.overdue ? 'overdue since' : 'next'} ${shortDay(dayOf(first.date))} · ${relativeDays(dayOf(first.date))}` : p.nextDate ? `next ${shortDay(p.nextDate)}` : 'nothing due'}
          </Text>
        </View>

        {first ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.lg }}>
            <Btn primary icon="checkmark" label="Book now" onPress={() => void actions.book(first)} />
            <Btn icon="play-skip-forward-outline" label="Skip" onPress={() => void actions.skip(first)} />
            <Btn icon="arrow-forward-outline" label="+1 week" onPress={() => void actions.postpone(first, 7)} />
            <Btn icon="calendar-outline" label="+1 month" onPress={() => void actions.postpone(first, 30)} />
          </View>
        ) : null}

        <Section title="Details" />
        <Card>
          <KV label="Account" value={p.toAccountName ? `${p.accountName} → ${p.toAccountName}` : p.accountName} onPress={() => router.push(`/account/${p.accountId}`)} />
          {p.categoryLabel ? (
            <KV label="Category" value={p.categoryLabel} onPress={() => router.push({ pathname: '/category/[label]', params: { label: p.categoryLabel! } })} />
          ) : null}
          <KV label="Started" value={shortDay(p.startDate)} />
          {p.endDate ? <KV label="Ends" value={shortDay(p.endDate)} /> : null}
          <KV label="Last booked" value={p.lastBookedOn ? shortDay(p.lastBookedOn) : 'never'} />
          <KV label="Per month" strong value={`${sign}${mask(formatAmount(p.monthlyEquivalent), 'all')}`} />
        </Card>

        <Section title="Coming up" detail={`${next.length} in the next 60 days`} />
        <Card>
          {next.length ? (
            next.map((o) => (
              <KV
                key={o.date}
                label={`${shortDay(dayOf(o.date))}${o.overdue ? ' · overdue' : dayOf(o.date) === today ? ' · today' : ''}`}
                value={`${sign}${mask(formatAmount(o.amount), 'all')}`}
                color={o.overdue ? theme.negative : undefined}
              />
            ))
          ) : (
            <Text style={[type.label, { color: theme.textFaint }]}>Nothing in the next 60 days.</Text>
          )}
        </Card>

        <Card padded={false} style={{ marginTop: space.xl }}>
          <SwitchRow
            icon="flash-outline"
            label="Book automatically"
            hint="Posts it on the day without asking"
            value={p.autoBook}
            onChange={(v) => void mutate((t) => api.updatePlanned(t, p.id, { autoBook: v }))}
          />
          <Divider />
          <SwitchRow
            icon="pause-outline"
            label="Active"
            hint="Paused plans don't count toward safe to spend"
            value={p.isActive}
            onChange={(v) => void mutate((t) => api.updatePlanned(t, p.id, { isActive: v }))}
          />
        </Card>

        <Section title="Edit" />
        <Card>
          <View style={{ gap: space.sm }}>
            <Field value={name} onChangeText={setName} placeholder="Name" />
            <Field value={amount} onChangeText={setAmount} placeholder={`Amount · ${prefs.currency}`} keyboardType="decimal-pad" />
            <Segment<Frequency>
              options={[
                ['WEEKLY', 'Week'],
                ['MONTHLY', 'Month'],
                ['YEARLY', 'Year'],
                ['ONCE', 'Once'],
              ]}
              value={frequency}
              onChange={setFrequency}
            />
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.md }}>
          <Btn
            danger
            label="Delete"
            style={{ flex: 1 }}
            onPress={() =>
              void destructive(
                { title: `Delete “${p.name}”?`, message: 'Entries already booked stay.', confirmLabel: 'Delete' },
                () => mutate((t) => api.deletePlanned(t, p.id)),
                { onSuccess: () => router.back(), onError: (m) => toast.error('Could not delete', m) },
              )
            }
          />
          <Btn primary label={busy ? 'Saving…' : 'Save'} disabled={!dirty || busy} onPress={save} style={{ flex: 2 }} />
        </View>

        {booked.length ? (
          <>
            <Section title="Booked before" />
            <Card padded={false}>
              {booked.map((tx, i) => (
                <View key={tx.id}>
                  {i > 0 ? <Divider inset={64} /> : null}
                  <TransactionRow tx={tx} category={category} showDate onPress={() => router.push({ pathname: '/entry', params: { id: tx.id } })} />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
