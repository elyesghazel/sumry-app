import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Contribute } from '../../src/components/PlanForms';
import { Btn, Card, Divider, Empty, Field, Header, KV, Meter, Pills, Section, Segment } from '../../src/components/ui';
import { SwitchRow } from '../../src/components/Rows';
import { useToast } from '../../src/components/Toast';
import { useDestructiveAction } from '../../src/components/ConfirmDialog';
import { useApp } from '../../src/store';
import { budgetPot, formatAmount, goalPot, type BudgetPeriod, type BudgetPot, type GoalPot } from '../../src/core';
import { api } from '../../src/api';
import { shortDay } from '../../src/lib/dates';
import { usePreferences, useTheme } from '../../src/preferences';
import { space, type } from '../../src/theme';

/** A pot: one budget or one goal, with its numbers, its entries and its settings. */
export default function PotDetail() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const { progress, goals } = useApp();
  if (kind === 'goal') {
    const g = goals.find((x) => x.id === id);
    return g ? <GoalDetail pot={goalPot(g)} /> : <Missing />;
  }
  const b = progress.find((x) => x.budgetId === id);
  return b ? <BudgetDetail pot={budgetPot(b)} /> : <Missing />;
}

function Missing() {
  return (
    <Screen>
      <Header title="Pot" />
      <Empty text="This pot no longer exists." />
    </Screen>
  );
}

function Hero({ current, target, ratio, tone, caption }: { current: number; target: number; ratio: number; tone: 'ink' | 'ok' | 'warn' | 'over'; caption: string }) {
  const theme = useTheme();
  const { mask } = usePreferences();
  return (
    <View style={{ paddingHorizontal: space.xl }}>
      <Text style={[type.display, { color: tone === 'over' ? theme.negative : theme.text }]}>
        {mask(formatAmount(current), 'all')}
        <Text style={[type.label, { color: theme.textFaint }]}> of {formatAmount(target)}</Text>
      </Text>
      <Meter ratio={ratio} tone={tone} height={8} style={{ marginTop: space.md }} />
      <Text style={[type.label, { color: tone === 'over' ? theme.negative : theme.textMuted, marginTop: 6 }]}>{caption}</Text>
    </View>
  );
}

function BudgetDetail({ pot }: { pot: BudgetPot }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, mask } = usePreferences();
  const { transactions, categories, budgets, mutate } = useApp();
  const toast = useToast();
  const destructive = useDestructiveAction();
  const b = pot.budget;
  const def = budgets.find((x) => x.id === b.budgetId);
  const [limit, setLimit] = useState(String(def?.limitAmount ?? b.limitAmount));
  const [period, setPeriod] = useState<BudgetPeriod>(def?.period ?? b.period);
  const [rollover, setRollover] = useState(def?.rollover ?? b.rollover);
  const [busy, setBusy] = useState(false);

  const entries = useMemo(() => {
    const from = new Date(`${b.periodStart.slice(0, 10)}T00:00:00`).getTime();
    const to = new Date(`${b.periodEnd.slice(0, 10)}T23:59:59`).getTime();
    return transactions
      .filter((t) => t.categoryLabel === b.categoryLabel && t.kind === 'EXPENSE')
      .filter((t) => {
        const ms = new Date(t.date).getTime();
        return ms >= from && ms <= to;
      })
      .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
  }, [transactions, b]);
  const category = categories.find((c) => c.label === b.categoryLabel);
  const tone = pot.status === 'over' ? 'over' : pot.status === 'warn' ? 'warn' : 'ink';
  const value = Number.parseFloat(limit.replace(',', '.'));
  const dirty = def && (value !== def.limitAmount || period !== def.period || rollover !== def.rollover);

  const save = async () => {
    if (!Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    try {
      await mutate((t) => api.updateBudget(t, b.budgetId, { limitAmount: value, period, rollover }));
      toast.success('Budget saved', `${b.categoryLabel} · ${prefs.currency} ${formatAmount(value)}`);
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={b.categoryLabel} subtitle={`${b.period.toLowerCase()} budget`} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <Hero
          current={b.spentAmount}
          target={pot.target}
          ratio={pot.ratio}
          tone={tone}
          caption={
            pot.status === 'over'
              ? `${formatAmount(-pot.remaining)} over · ${Math.round(pot.ratio * 100)}%`
              : `${formatAmount(pot.remaining)} left · ${formatAmount(b.perDayLeft)} a day for ${b.daysLeft} d`
          }
        />

        <Section title="This period" detail={`${shortDay(b.periodStart)} – ${shortDay(b.periodEnd)}`} />
        <Card>
          <KV label="Limit" value={formatAmount(b.limitAmount)} />
          {b.rollover ? <KV label="Carried over" value={`${b.carry >= 0 ? '+' : '−'}${formatAmount(b.carry)}`} /> : null}
          {b.rollover ? <KV label="Available" value={formatAmount(b.effectiveLimit)} /> : null}
          <KV label="Spent" value={mask(formatAmount(b.spentAmount), 'all')} />
          <KV label="Left" strong value={`${pot.remaining < 0 ? '−' : ''}${mask(formatAmount(pot.remaining), 'all')}`} color={pot.remaining < 0 ? theme.negative : undefined} />
          <KV label="Pace" value={b.pace === 'over' ? 'ahead of the calendar' : b.pace === 'under' ? 'below the calendar' : 'on track'} color={b.pace === 'over' ? theme.accent : undefined} />
          <View style={{ marginTop: space.sm }}>
            <Btn small icon="pricetag-outline" label={`${b.categoryLabel} over time`} onPress={() => router.push({ pathname: '/category/[label]', params: { label: b.categoryLabel } })} />
          </View>
        </Card>

        <Section title="Edit" />
        <Card>
          <View style={{ gap: space.sm }}>
            <Field value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder={`Limit · ${prefs.currency}`} />
            <Segment<BudgetPeriod>
              options={[
                ['WEEKLY', 'Weekly'],
                ['MONTHLY', 'Monthly'],
                ['YEARLY', 'Yearly'],
              ]}
              value={period}
              onChange={setPeriod}
            />
          </View>
        </Card>
        <Card padded={false} style={{ marginTop: space.sm }}>
          <SwitchRow label="Roll over" hint="Unspent money (or overspend) carries into the next period" value={rollover} onChange={setRollover} />
        </Card>
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.md }}>
          <Btn
            danger
            label="Remove"
            style={{ flex: 1 }}
            onPress={() =>
              void destructive(
                { title: `Remove the ${b.categoryLabel} budget?`, message: 'Its entries are not affected.', confirmLabel: 'Remove' },
                () => mutate((t) => api.deleteBudget(t, b.budgetId)),
                { onSuccess: () => router.back(), onError: (m) => toast.error('Could not remove', m) },
              )
            }
          />
          <Btn primary label={busy ? 'Saving…' : 'Save'} disabled={!dirty || busy} onPress={save} style={{ flex: 2 }} />
        </View>

        <Section title="Entries this period" detail={`${entries.length}`} />
        <Card padded={false}>
          {entries.map((tx, i) => (
            <View key={tx.id}>
              {i > 0 ? <Divider inset={64} /> : null}
              <TransactionRow tx={tx} category={category} showDate onPress={() => router.push({ pathname: '/entry', params: { id: tx.id } })} />
            </View>
          ))}
          {entries.length === 0 ? <Empty text="Nothing spent here yet this period." /> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function GoalDetail({ pot }: { pot: GoalPot }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, mask } = usePreferences();
  const { accounts, mutate } = useApp();
  const toast = useToast();
  const destructive = useDestructiveAction();
  const g = pot.goal;
  const [name, setName] = useState(g.name);
  const [target, setTarget] = useState(String(g.targetAmount));
  const [date, setDate] = useState(g.targetDate ?? '');
  const [accountId, setAccountId] = useState<string>(g.accountId ?? '');
  const [saved, setSaved] = useState(g.accountId ? '' : String(g.current));
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const tone = pot.status === 'done' ? 'ok' : pot.status === 'behind' ? 'over' : 'ink';
  const t = Number.parseFloat(target.replace(',', '.'));
  const s = Number.parseFloat(saved.replace(',', '.'));
  const dateOk = date === '' || /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = async () => {
    if (!name.trim() || !(t > 0) || !dateOk) return;
    setBusy(true);
    try {
      await mutate((tok) =>
        api.updateGoal(tok, g.id, {
          name: name.trim(),
          targetAmount: t,
          ...(date ? { targetDate: date } : { clearTargetDate: true }),
          ...(accountId ? { accountId } : { clearAccount: true }),
          ...(!accountId && Number.isFinite(s) ? { savedAmount: s } : {}),
        }),
      );
      toast.success('Goal saved', name.trim());
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={g.name} subtitle={g.accountName ? `tracks ${g.accountName}` : 'goal · own count'} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <Hero
          current={g.current}
          target={g.targetAmount}
          ratio={pot.ratio}
          tone={tone}
          caption={g.achieved ? 'Reached' : `${formatAmount(g.remaining)} to go · ${Math.round(pot.ratio * 100)}%`}
        />

        <Section title="Progress" />
        <Card>
          <KV label="Saved" value={mask(formatAmount(g.current))} />
          <KV label="Target" value={formatAmount(g.targetAmount)} />
          <KV label="By" value={g.targetDate ? shortDay(g.targetDate) : 'no date'} />
          {g.monthsLeft !== null ? <KV label="Months left" value={String(g.monthsLeft)} /> : null}
          {g.requiredPerMonth !== null && !g.achieved ? <KV label="Needed a month" strong value={formatAmount(g.requiredPerMonth)} /> : null}
          {g.onTrack !== null && !g.achieved ? (
            <KV label="Status" value={g.onTrack ? 'on track' : 'behind'} color={g.onTrack ? theme.positive : theme.negative} />
          ) : null}
          {!g.achieved ? (
            <View style={{ marginTop: space.sm }}>
              {adding ? (
                <Contribute goal={g} onDone={() => setAdding(false)} />
              ) : (
                <Btn small primary icon="add" label="Add money" onPress={() => setAdding(true)} style={{ alignSelf: 'flex-start' }} />
              )}
            </View>
          ) : null}
        </Card>

        <Section title="Edit goal" />
        <Card>
          <View style={{ gap: space.sm }}>
            <Field value={name} onChangeText={setName} placeholder="Name" />
            <Field value={target} onChangeText={setTarget} placeholder={`Target · ${prefs.currency}`} keyboardType="decimal-pad" />
            <Field value={date} onChangeText={setDate} placeholder="Target date YYYY-MM-DD (optional)" autoCapitalize="none" />
            {!dateOk ? <Text style={[type.caption, { color: theme.negative }]}>Use the form 2027-06-30.</Text> : null}
            <Text style={[type.caption, { color: theme.textFaint, marginTop: space.xs }]}>TRACKS AN ACCOUNT</Text>
            <Pills
              items={[{ key: '', label: 'My own count' }, ...accounts.map((a) => ({ key: a.id, label: a.accountName }))]}
              selected={accountId}
              onSelect={setAccountId}
            />
            {!accountId ? <Field value={saved} onChangeText={setSaved} placeholder="Already saved" keyboardType="decimal-pad" /> : null}
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.md }}>
          <Btn
            danger
            label="Delete"
            style={{ flex: 1 }}
            onPress={() =>
              void destructive(
                { title: `Delete the goal “${g.name}”?`, message: 'The money stays where it is.', confirmLabel: 'Delete' },
                () => mutate((tok) => api.deleteGoal(tok, g.id)),
                { onSuccess: () => router.back(), onError: (m) => toast.error('Could not delete', m) },
              )
            }
          />
          <Btn label={g.isActive ? 'Pause' : 'Resume'} style={{ flex: 1 }} onPress={() => void mutate((tok) => api.updateGoal(tok, g.id, { isActive: !g.isActive }))} />
          <Btn primary label={busy ? 'Saving…' : 'Save'} disabled={busy || !dateOk} onPress={save} style={{ flex: 2 }} />
        </View>
      </ScrollView>
    </Screen>
  );
}
