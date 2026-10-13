import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Delta } from '../../src/components/Delta';
import { useApp } from '../../src/store';
import { usePreferences, useTheme, TIMEFRAMES } from '../../src/preferences';
import { accountDelta, resolveRange, totals } from '../../src/analytics';
import { formatAmount, relativeDays } from '../../src/format';
import { api, BudgetProgress, Occurrence } from '../../src/api';
import { useToast } from '../../src/components/Toast';
import { useDeleteTransaction } from '../../src/actions';
import { categoryColor, radius, space, type } from '../../src/theme';

// How far ahead the plan list looks, and how many rows each list shows before folding.
const PLAN_DAYS = 30;
const PLAN_ROWS = 6;
const BUDGET_ROWS = 6;

const overBy = (p: BudgetProgress) => p.spentAmount - p.effectiveLimit;
const isOver = (p: BudgetProgress) => overBy(p) > 0.005;
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The overview answers three questions in order: how much is free, am I over a budget,
 * what is about to go out. The charts and the forecast breakdown live in Insights.
 */
export default function Overview() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, tick, hidden, reveal, mask } = usePreferences();
  const { accounts, categories, transactions, refreshing, refresh, error, safe, forecast, upcoming, progress, mutate } = useApp();
  const toast = useToast();
  const deleteTransaction = useDeleteTransaction();
  const [allBudgets, setAllBudgets] = useState(false);
  const [allPlanned, setAllPlanned] = useState(false);

  const range = useMemo(() => resolveRange(prefs.timeframe), [prefs.timeframe]);

  const categoryByLabel = useMemo(
    () => new Map(categories.map((c) => [c.label, c])),
    [categories],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.accountName])),
    [accounts],
  );

  const netWorth = useMemo(
    () => accounts.reduce((sum, a) => sum + (a.baseBalance ?? a.currentBalance ?? 0), 0),
    [accounts],
  );

  const periodTotals = useMemo(() => totals(transactions, range), [transactions, range]);

  // Net movement across every account over the window — the change behind the headline.
  const netChange = useMemo(
    () => accounts.reduce((sum, a) => sum + accountDelta(a, transactions, range), 0),
    [accounts, transactions, range],
  );

  // Worst first: overspent envelopes by how far over, then the rest by how full they are.
  const budgets = useMemo(
    () =>
      [...progress].sort((a, b) => {
        const oa = isOver(a);
        const ob = isOver(b);
        if (oa !== ob) return oa ? -1 : 1;
        if (oa) return overBy(b) - overBy(a);
        const ra = a.effectiveLimit > 0 ? a.spentAmount / a.effectiveLimit : 0;
        const rb = b.effectiveLimit > 0 ? b.spentAmount / b.effectiveLimit : 0;
        return rb - ra;
      }),
    [progress],
  );
  const overBudgets = useMemo(() => budgets.filter(isOver), [budgets]);
  const overTotal = useMemo(() => overBudgets.reduce((s, p) => s + overBy(p), 0), [overBudgets]);
  // Never fold away an overspent budget.
  const budgetFold = Math.max(BUDGET_ROWS, overBudgets.length);
  const shownBudgets = allBudgets ? budgets : budgets.slice(0, budgetFold);

  // Overdue first, then everything due within the next month.
  const plan = useMemo(() => {
    const today = todayIso();
    const horizon = new Date(Date.now() + PLAN_DAYS * 86_400_000).toISOString().slice(0, 10);
    const overdue = upcoming.filter((o) => o.overdue);
    const items = [...overdue, ...upcoming.filter((o) => !o.overdue && o.date <= horizon)];
    const sum = (pred: (o: Occurrence) => boolean) =>
      items.filter(pred).reduce((s, o) => s + o.amount, 0);
    return {
      items,
      overdue: overdue.length,
      toBook: items.filter((o) => !o.autoBook && (o.overdue || o.date <= today)).length,
      income: sum((o) => o.kind === 'INCOME'),
      out: sum((o) => o.kind !== 'INCOME'),
    };
  }, [upcoming]);
  const planFold = Math.max(PLAN_ROWS, plan.overdue);
  const shownPlan = allPlanned ? plan.items : plan.items.slice(0, planFold);

  const nextIncome = useMemo(
    () => (safe ? upcoming.find((o) => o.kind === 'INCOME' && o.date === safe.horizon) : undefined),
    [safe, upcoming],
  );

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [transactions],
  );

  const bookNow = async (id: string, name: string) => {
    tick();
    try {
      await mutate((t) => api.bookPlanned(t, id));
      toast.success('Booked', name);
    } catch (e) {
      toast.error('Could not book', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const cycleTimeframe = () => {
    const i = TIMEFRAMES.findIndex((t) => t.key === prefs.timeframe);
    tick();
    set('timeframe', TIMEFRAMES[(i + 1) % TIMEFRAMES.length].key);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />
        }
      >
        {error ? (
          <Text style={[type.label, styles.error, { color: theme.negative }]}>{error}</Text>
        ) : null}

        {/* Safe to spend — what is actually free before the next planned income. */}
        <View style={styles.hero}>
          <Pressable onPress={cycleTimeframe} hitSlop={8} style={styles.timeframeRow}>
            <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
              {safe ? 'Safe to spend' : 'Total balance'}
            </Text>
            <View style={[styles.timeframeChip, { backgroundColor: theme.keypad }]}>
              <Text style={[type.caption, { color: theme.textMuted }]}>{range.label}</Text>
              <Ionicons name="chevron-down" size={11} color={theme.textFaint} />
            </View>
          </Pressable>

          {/* Tapping the figure reveals it; it re-hides as soon as the app is backgrounded. */}
          <Pressable
            onPress={() => {
              if (prefs.privacy !== 'off') {
                tick();
                reveal();
              }
            }}
            style={styles.heroAmount}
            accessibilityRole={prefs.privacy !== 'off' ? 'button' : undefined}
            accessibilityLabel={hidden ? 'Balance hidden, tap to reveal' : undefined}
          >
            <Text
              style={[
                type.display,
                { color: safe && safe.safeToSpend < 0 ? theme.negative : theme.text },
              ]}
            >
              {safe && safe.safeToSpend < 0 ? '−' : ''}
              {mask(formatAmount(safe ? safe.safeToSpend : netWorth))}
            </Text>
            <Text style={[type.label, { color: theme.textFaint, marginBottom: 10 }]}>
              {' '}
              {prefs.currency}
            </Text>
            {prefs.privacy !== 'off' ? (
              <Ionicons
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={theme.textFaint}
                style={{ marginBottom: 12, marginLeft: space.sm }}
              />
            ) : null}
          </Pressable>

          {hidden ? (
            <Text style={[type.label, { color: theme.textFaint }]}>Hidden · tap to show</Text>
          ) : (
            <View style={{ gap: 2 }}>
              {safe ? (
                <Text style={[type.label, { color: theme.textMuted }]}>
                  {formatAmount(safe.perDay)} a day until {nextIncome ? `${nextIncome.name} ` : ''}
                  {relativeDays(safe.horizon)}
                </Text>
              ) : null}
              <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>
                Net worth {formatAmount(netWorth)} · in {formatAmount(periodTotals.income)} · out{' '}
                {formatAmount(periodTotals.expense)}
              </Text>
              <View style={{ marginTop: 4 }}>
                <Delta value={netChange} suffix={`in ${range.label.toLowerCase()}`} />
              </View>
            </View>
          )}
        </View>

        {/* Three verdicts, readable without scrolling; each opens its detail. */}
        <View style={styles.tiles}>
          <Tile
            label="Budgets"
            value={progress.length ? (overBudgets.length ? `${overBudgets.length} over` : 'On track') : 'None'}
            hint={
              progress.length
                ? overBudgets.length
                  ? `${mask(formatAmount(overTotal), 'all')} too much`
                  : `${progress.length} envelopes`
                : 'set a cap'
            }
            tone={overBudgets.length ? 'negative' : progress.length ? 'positive' : undefined}
            onPress={() => router.push('/budgets')}
          />
          <Tile
            label="Planned"
            value={
              plan.toBook
                ? `${plan.toBook} to book`
                : plan.items.length
                  ? `−${mask(formatAmount(plan.out), 'all')}`
                  : 'Nothing'
            }
            hint={plan.toBook ? 'due now' : plan.items.length ? `next ${PLAN_DAYS} days` : 'rent, salary…'}
            tone={plan.overdue ? 'negative' : undefined}
            onPress={() => router.push('/plan')}
          />
          <Tile
            label="Month end"
            value={
              forecast
                ? `${forecast.projectedNet < 0 ? '−' : '+'}${mask(formatAmount(forecast.projectedNet), 'all')}`
                : '—'
            }
            hint={
              forecast
                ? forecast.verdict === 'over'
                  ? 'above usual'
                  : forecast.verdict === 'under'
                    ? 'below usual'
                    : 'about usual'
                : 'no forecast yet'
            }
            tone={forecast ? (forecast.projectedNet < 0 ? 'negative' : 'positive') : undefined}
            onPress={() => router.push('/insights')}
          />
        </View>

        {/* Budgets, worst first, so an overspend is the first line of the card. */}
        <SectionHeading
          title="Budgets"
          detail={progress.length ? `${overBudgets.length} of ${progress.length} over` : undefined}
          detailColor={overBudgets.length ? theme.negative : undefined}
          action={progress.length ? 'Edit' : 'Set one'}
          onAction={() => router.push('/budgets')}
        />
        <Glass style={styles.card}>
          {progress.length ? (
            <View style={[styles.cardInner, { gap: space.md }]}>
              {shownBudgets.map((p) => (
                <BudgetRow
                  key={p.budgetId}
                  p={p}
                  color={categoryColor(theme, p.categoryLabel, categoryByLabel.get(p.categoryLabel)?.color ?? p.categoryColor)}
                />
              ))}
              {budgets.length > budgetFold ? (
                <MoreToggle
                  open={allBudgets}
                  count={budgets.length - budgetFold}
                  onPress={() => {
                    tick();
                    setAllBudgets((v) => !v);
                  }}
                />
              ) : null}
            </View>
          ) : (
            <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>
              No budgets yet. Put a cap on Essen gehen or Shopping and this card tells you the moment you pass it.
            </Text>
          )}
        </Glass>

        {/* What is due in the next month; anything due and manual can be booked here. */}
        <SectionHeading
          title="Planned"
          detail={
            plan.items.length
              ? `${plan.income ? `+${mask(formatAmount(plan.income), 'all')} · ` : ''}−${mask(formatAmount(plan.out), 'all')}`
              : undefined
          }
          action={plan.items.length ? 'Plan' : 'Add a plan'}
          onAction={() => router.push('/plan')}
        />
        <Glass style={styles.card}>
          {plan.items.length ? (
            <View style={{ paddingVertical: space.xs }}>
              {shownPlan.map((o, i) => {
                const prev = shownPlan[i - 1];
                const newDay = !prev || prev.date !== o.date || prev.overdue !== o.overdue;
                const due = !o.autoBook && (o.overdue || o.date <= todayIso());
                return (
                  <View key={`${o.plannedId}-${o.date}`}>
                    {i > 0 ? (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: theme.hairline, marginLeft: newDay ? space.lg : 96 },
                        ]}
                      />
                    ) : null}
                    <View style={styles.upRow}>
                      <Text
                        style={[type.caption, { color: o.overdue ? theme.negative : theme.textFaint, width: 72 }]}
                        numberOfLines={1}
                      >
                        {newDay ? (o.overdue ? 'OVERDUE' : dayLabel(o.date)) : ''}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                          {o.name}
                        </Text>
                        <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
                          {o.toAccountName ? `→ ${o.toAccountName}` : o.categoryLabel ?? o.accountName}
                          {o.autoBook ? ' · auto' : ''}
                        </Text>
                      </View>
                      <Text
                        style={[
                          type.amount,
                          { color: o.kind === 'INCOME' ? theme.positive : theme.text, fontSize: 15 },
                        ]}
                      >
                        {o.kind === 'INCOME' ? '+' : '−'}
                        {mask(formatAmount(o.amount), 'all')}
                      </Text>
                      {due ? (
                        <Pressable
                          onPress={() => bookNow(o.plannedId, o.name)}
                          hitSlop={6}
                          style={[styles.bookBtn, { borderColor: o.overdue ? theme.negative : theme.hairlineStrong }]}
                        >
                          <Text style={[type.caption, { color: o.overdue ? theme.negative : theme.text }]}>BOOK</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {plan.items.length > planFold ? (
                <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
                  <MoreToggle
                    open={allPlanned}
                    count={plan.items.length - planFold}
                    onPress={() => {
                      tick();
                      setAllPlanned((v) => !v);
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>
              Nothing planned yet. Add Lohn, Miete and your subscriptions under Plan — then this screen knows what is safe to spend before payday.
            </Text>
          )}
        </Glass>

        {/* Accounts as ledger lines: name on the left, balance and its movement on the right. */}
        <SectionHeading title="Accounts" />
        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.xs }}>
            {accounts.map((a, i) => {
              const foreign = a.currency && a.currency !== prefs.currency;
              return (
                <View key={a.id}>
                  {i > 0 ? (
                    <View style={[styles.divider, { backgroundColor: theme.hairline, marginLeft: space.lg }]} />
                  ) : null}
                  <View style={styles.accountRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                        {a.accountName}
                      </Text>
                      {foreign && a.baseBalance != null ? (
                        <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>
                          ≈ {mask(formatAmount(a.baseBalance))} {prefs.currency}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[type.amount, { color: theme.text }]}>
                        {mask(formatAmount(a.currentBalance ?? 0))}
                        {foreign ? <Text style={[type.caption, { color: theme.textFaint }]}> {a.currency}</Text> : null}
                      </Text>
                      {hidden ? null : <Delta value={accountDelta(a, transactions, range)} size="sm" />}
                    </View>
                  </View>
                </View>
              );
            })}
            {accounts.length === 0 ? (
              <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>
                No accounts yet — add one in Settings.
              </Text>
            ) : null}
          </View>
        </Glass>

        {/* Recent activity */}
        <SectionHeading
          title="Recent"
          action="See all"
          onAction={() => router.push('/transactions')}
        />
        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.xs }}>
            {recent.map((tx, i) => (
              <View key={tx.id}>
                {i > 0 ? (
                  <View style={[styles.divider, { backgroundColor: theme.hairline, marginLeft: 64 }]} />
                ) : null}
                <TransactionRow
                  tx={tx}
                  category={categoryByLabel.get(tx.categoryLabel ?? '')}
                  accountName={accountById.get(tx.userAccountId ?? '')}
                  showAccount={accounts.length > 1}
                  onPress={() => router.push({ pathname: '/entry', params: { id: tx.id } })}
                  onDelete={() => deleteTransaction(tx)}
                />
              </View>
            ))}
            {recent.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={22} color={theme.textFaint} />
                <Text style={[type.label, { color: theme.textFaint, marginTop: space.sm }]}>
                  Nothing logged yet. Tap + to start.
                </Text>
              </View>
            ) : null}
          </View>
        </Glass>
      </ScrollView>
    </Screen>
  );
}

/** "TODAY", "TOMORROW", "FRI 23" within the week, "23 NOV" beyond it. */
function dayLabel(iso: string): string {
  const rel = relativeDays(iso);
  if (rel === 'today' || rel === 'tomorrow') return rel.toUpperCase();
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const withinWeek = d.getTime() - Date.now() < 6 * 86_400_000;
  return d
    .toLocaleDateString('en-GB', withinWeek ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' })
    .toUpperCase();
}

function BudgetRow({ p, color }: { p: BudgetProgress; color: string }) {
  const theme = useTheme();
  const { mask } = usePreferences();
  const over = isOver(p);
  const ratio = p.effectiveLimit > 0 ? p.spentAmount / p.effectiveLimit : 1;
  // Red only once the cap is passed; amber while spending runs ahead of the calendar.
  const fill = over ? theme.negative : p.pace === 'over' ? theme.accent : theme.text;
  return (
    <View>
      <View style={styles.between}>
        <View style={[styles.flowLabel, { flex: 1 }]}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={[type.body, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
            {p.categoryLabel}
          </Text>
        </View>
        <Text style={[type.label, { color: over ? theme.negative : theme.textMuted }]}>
          {over
            ? `${mask(formatAmount(overBy(p)), 'all')} over`
            : `${mask(formatAmount(p.effectiveLimit - p.spentAmount), 'all')} left`}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.keypad, marginTop: 6 }]}>
        <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, ratio * 100))}%`, backgroundColor: fill }]} />
      </View>
      <Text style={[type.caption, { color: theme.textFaint, marginTop: 4, letterSpacing: 0.2 }]}>
        {mask(formatAmount(p.spentAmount), 'all')} of {formatAmount(p.effectiveLimit)}
        {over
          ? ` · ${Math.round(ratio * 100)}%`
          : p.daysLeft > 0
            ? ` · ${mask(formatAmount(p.perDayLeft), 'all')} a day for ${p.daysLeft} days`
            : ''}
      </Text>
    </View>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'positive' | 'negative';
  onPress: () => void;
}) {
  const theme = useTheme();
  const { tick } = usePreferences();
  const color = tone === 'negative' ? theme.negative : tone === 'positive' ? theme.positive : theme.text;
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: tone === 'negative' ? theme.negative : theme.hairline,
          backgroundColor: theme.bgElevated,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}, ${hint}`}
    >
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{label}</Text>
      <Text style={[type.amount, { color, marginTop: 6 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

function MoreToggle({ open, count, onPress }: { open: boolean; count: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.more}>
      <Text style={[type.label, { color: theme.textMuted }]}>{open ? 'Show less' : `${count} more`}</Text>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textFaint} />
    </Pressable>
  );
}

function SectionHeading({
  title,
  detail,
  detailColor,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  detailColor?: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionTitle}>
        <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
          {title}
        </Text>
        {detail ? (
          <Text style={[type.caption, { color: detailColor ?? theme.textMuted, letterSpacing: 0.2 }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[type.label, { color: theme.textMuted }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { paddingHorizontal: space.xl, marginBottom: space.sm },
  hero: { paddingHorizontal: space.xl, marginBottom: space.xl },
  timeframeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeframeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroAmount: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm },
  card: { marginHorizontal: space.lg },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  tile: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md },
  cardInner: { padding: space.lg },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  flowLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flex: 1 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  divider: { height: StyleSheet.hairlineWidth },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  bookBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: space.xl },
});
