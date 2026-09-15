import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Delta } from '../../src/components/Delta';
import { Sparkline } from '../../src/components/charts';
import { useApp } from '../../src/store';
import { usePreferences, useTheme, TIMEFRAMES } from '../../src/preferences';
import {
  accountDelta,
  resolveRange,
  spendBuckets,
  totals,
} from '../../src/analytics';
import { formatAmount, relativeDays } from '../../src/format';
import { api } from '../../src/api';
import { useToast } from '../../src/components/Toast';
import { useDeleteTransaction } from '../../src/actions';
import { categoryColor, radius, space, type } from '../../src/theme';

export default function Overview() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, tick, hidden, reveal, mask } = usePreferences();
  const { accounts, categories, transactions, refreshing, refresh, error, safe, forecast, upcoming, progress, planned, goals, mutate } = useApp();
  const toast = useToast();
  const deleteTransaction = useDeleteTransaction();

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

  const soon = useMemo(() => upcoming.filter((o) => !o.overdue).slice(0, 5), [upcoming]);
  const overdue = useMemo(() => upcoming.filter((o) => o.overdue), [upcoming]);

  const bookNow = async (id: string, name: string) => {
    tick();
    try {
      await mutate((t) => api.bookPlanned(t, id));
      toast.success('Booked', name);
    } catch (e) {
      toast.error('Could not book', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const periodTotals = useMemo(() => totals(transactions, range), [transactions, range]);

  // Net movement across every account over the window — the change behind the headline.
  const netChange = useMemo(
    () => accounts.reduce((sum, a) => sum + accountDelta(a, transactions, range), 0),
    [accounts, transactions, range],
  );

  const trend = useMemo(
    () => spendBuckets(transactions, range).map((b) => b.value),
    [transactions, range],
  );

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [transactions],
  );

  const flowMax = Math.max(periodTotals.income, periodTotals.expense, 1);

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
          ) : safe ? (
            <View style={{ gap: 2 }}>
              <Text style={[type.label, { color: theme.textMuted }]}>
                {formatAmount(safe.perDay)} a day for {safe.daysToHorizon} days · until{' '}
                {relativeDays(safe.horizon)}
              </Text>
              <Text style={[type.caption, { color: theme.textFaint }]}>
                {formatAmount(safe.balance)} on hand − {formatAmount(safe.upcomingExpenses)} committed
                {' · '}net worth {formatAmount(netWorth)}
              </Text>
              <View style={{ marginTop: 4 }}>
                <Delta value={netChange} suffix={`in ${range.label.toLowerCase()}`} />
              </View>
            </View>
          ) : (
            <Delta value={netChange} suffix={`in ${range.label.toLowerCase()}`} />
          )}
        </View>

        {/* Always reachable, whether or not anything is planned yet. */}
        <View style={styles.shortcuts}>
          <Shortcut icon="calendar-outline" label="Plan" hint={planned.length ? `${planned.length} planned` : 'rent, salary…'} onPress={() => router.push('/plan')} />
          <Shortcut icon="pie-chart-outline" label="Budgets" hint={progress.length ? `${progress.length} set` : 'set a cap'} onPress={() => router.push('/budgets')} />
          <Shortcut icon="flag-outline" label="Goals" hint={goals.length ? `${goals.length} saving` : 'save toward'} onPress={() => router.push('/plan')} />
        </View>

        {/* Where the month is heading, in three lines. */}
        {forecast ? (
          <Glass style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.cardHead}>
                <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
                  Month end
                </Text>
                <Text
                  style={[
                    type.caption,
                    {
                      color:
                        forecast.verdict === 'over'
                          ? theme.negative
                          : forecast.verdict === 'under'
                            ? theme.positive
                            : theme.textFaint,
                    },
                  ]}
                >
                  {forecast.verdict === 'over' ? 'ABOVE USUAL' : forecast.verdict === 'under' ? 'BELOW USUAL' : 'ON THE USUAL'}
                </Text>
              </View>
              <Line label="Spent so far" value={mask(formatAmount(forecast.spentSoFar), 'all')} />
              <Line label="Still planned" value={mask(formatAmount(forecast.plannedExpensesRemaining), 'all')} />
              <Line
                label={`Everyday, ${forecast.daysLeft} days × ${formatAmount(forecast.baselineDailyPace)}`}
                value={mask(formatAmount(forecast.baselineDailyPace * forecast.daysLeft), 'all')}
              />
              <Line label="Projected spend" value={mask(formatAmount(forecast.projectedSpend), 'all')} strong />
              <Line
                label="Projected net"
                value={`${forecast.projectedNet < 0 ? '−' : '+'}${mask(formatAmount(forecast.projectedNet))}`}
                color={forecast.projectedNet < 0 ? theme.negative : theme.positive}
              />
            </View>
          </Glass>
        ) : null}

        {/* What is due next; overdue items can be booked from here. */}
        <SectionHeading title="Upcoming" action={overdue.length || soon.length ? 'Plan' : 'Add a plan'} onAction={() => router.push('/plan')} />
        {overdue.length || soon.length ? (
          <>
            <Glass style={styles.card}>
              <View style={{ paddingVertical: space.xs }}>
                {[...overdue, ...soon].map((o, i) => (
                  <View key={`${o.plannedId}-${o.date}`}>
                    {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.hairline, marginLeft: space.lg }]} /> : null}
                    <View style={styles.upRow}>
                      <Text
                        style={[type.caption, { color: o.overdue ? theme.negative : theme.textFaint, width: 64 }]}
                        numberOfLines={1}
                      >
                        {o.overdue ? 'OVERDUE' : relativeDays(o.date).toUpperCase()}
                      </Text>
                      <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                        {o.name}
                      </Text>
                      <Text
                        style={[
                          type.amount,
                          { color: o.kind === 'INCOME' ? theme.positive : theme.text },
                        ]}
                      >
                        {o.kind === 'INCOME' ? '+' : o.kind === 'TRANSFER_OUT' ? '' : '−'}
                        {mask(formatAmount(o.amount), 'all')}
                      </Text>
                      {!o.autoBook && (o.overdue || o.date <= new Date().toISOString().slice(0, 10)) ? (
                        <Pressable
                          onPress={() => bookNow(o.plannedId, o.name)}
                          hitSlop={6}
                          style={[styles.bookBtn, { borderColor: theme.hairlineStrong }]}
                        >
                          <Text style={[type.caption, { color: theme.text }]}>BOOK</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </Glass>
          </>
        ) : (
          <Glass style={styles.card}>
            <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>
              Nothing planned yet. Add Lohn, Miete and your subscriptions under Plan — then this screen knows what is safe to spend before payday.
            </Text>
          </Glass>
        )}

        {/* Budgets at a glance. */}
        {progress.length ? (
          <>
            <SectionHeading title="Budgets" action="All" onAction={() => router.push('/budgets')} />
            <Glass style={styles.card}>
              <View style={[styles.cardInner, { gap: space.md }]}>
                {progress.slice(0, 4).map((p) => {
                  const ratio = p.effectiveLimit > 0 ? p.spentAmount / p.effectiveLimit : 1;
                  return (
                    <View key={p.budgetId}>
                      <View style={styles.flowHeader}>
                        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                          {p.categoryLabel}
                        </Text>
                        <Text style={[type.label, { color: p.pace === 'over' ? theme.negative : theme.textMuted }]}>
                          {mask(formatAmount(p.spentAmount), 'all')} / {formatAmount(p.effectiveLimit)}
                        </Text>
                      </View>
                      <View style={[styles.track, { backgroundColor: theme.keypad, height: 4 }]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
                              backgroundColor:
                                p.pace === 'over' ? theme.negative : p.pace === 'on' ? theme.accent : theme.text,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Glass>
          </>
        ) : null}

        {/* Spending shape over the window. */}
        {trend.some((v) => v > 0) ? (
          <Glass style={[styles.card, { marginTop: space.md }]}>
            <View style={styles.cardInner}>
              <View style={styles.cardHead}>
                <Text
                  style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}
                >
                  Spending
                </Text>
                <Text style={[type.amount, { color: theme.text, fontSize: 15 }]}>
                  {mask(formatAmount(periodTotals.expense), 'all')}
                </Text>
              </View>
              <Sparkline values={trend} color={theme.negative} />
            </View>
          </Glass>
        ) : null}

        {/* In vs out as two proportional bars — easier to read than two more numbers. */}
        <Glass style={[styles.card, { marginTop: space.md }]}>
          <View style={styles.cardInner}>
            <FlowBar
              label="In"
              amount={periodTotals.income}
              fraction={periodTotals.income / flowMax}
              color={theme.positive}
            />
            <View style={{ height: space.lg }} />
            <FlowBar
              label="Out"
              amount={periodTotals.expense}
              fraction={periodTotals.expense / flowMax}
              color={theme.negative}
            />
          </View>
        </Glass>

        {/* Accounts, each with its movement over the window. */}
        <SectionHeading title="Accounts" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountStrip}
        >
          {accounts.map((a, i) => {
            const delta = accountDelta(a, transactions, range);
            const accent = theme.categorical[i % theme.categorical.length];
            return (
              <Glass key={a.id} radiusSize={radius.md} style={styles.accountCard}>
                <View style={[styles.accountAccent, { backgroundColor: accent }]} />
                <View style={styles.accountInner}>
                  <Text style={[type.label, { color: theme.textMuted }]} numberOfLines={1}>
                    {a.accountName}
                    {a.currency && a.currency !== prefs.currency ? ` · ${a.currency}` : ''}
                  </Text>
                  <Text style={[type.amount, { color: theme.text, fontSize: 19, marginTop: 6 }]}>
                    {mask(formatAmount(a.currentBalance ?? 0))}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    {hidden ? (
                      <Text style={[type.caption, { color: theme.textFaint }]}>—</Text>
                    ) : (
                      <Delta value={delta} size="sm" />
                    )}
                  </View>
                </View>
              </Glass>
            );
          })}
          {accounts.length === 0 ? (
            <Text style={[type.label, { color: theme.textFaint, paddingHorizontal: space.lg }]}>
              No accounts yet — add one in Settings.
            </Text>
          ) : null}
        </ScrollView>

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
                  <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
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

function FlowBar({
  label,
  amount,
  fraction,
  color,
}: {
  label: string;
  amount: number;
  fraction: number;
  color: string;
}) {
  const theme = useTheme();
  const { mask } = usePreferences();
  return (
    <View>
      <View style={styles.flowHeader}>
        <View style={styles.flowLabel}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={[type.label, { color: theme.textMuted }]}>{label}</Text>
        </View>
        <Text style={[type.amount, { color: theme.text }]}>{mask(formatAmount(amount), 'all')}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.keypad }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: color, width: `${Math.max(2, Math.min(100, fraction * 100))}%` },
          ]}
        />
      </View>
    </View>
  );
}

function Shortcut({ icon, label, hint, onPress }: { icon: string; label: string; hint: string; onPress: () => void }) {
  const theme = useTheme();
  const { tick } = usePreferences();
  return (
    <Pressable
      onPress={() => { tick(); onPress(); }}
      style={({ pressed }) => [styles.shortcut, { borderColor: theme.hairline, backgroundColor: theme.bgElevated, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon as never} size={18} color={theme.accent} />
      <Text style={[type.label, { color: theme.text, marginTop: 6 }]}>{label}</Text>
      <Text style={[type.caption, { color: theme.textFaint }]} numberOfLines={1}>{hint}</Text>
    </Pressable>
  );
}

function Line({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.flowHeader, { marginBottom: 0, paddingVertical: 5 }]}>
      <Text style={[strong ? type.label : type.body, { color: strong ? theme.text : theme.textMuted, flex: 1 }]}>
        {label}
      </Text>
      <Text style={[type.amount, { color: color ?? theme.text, fontSize: strong ? 19 : 15 }]}>{value}</Text>
    </View>
  );
}

function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
        {title}
      </Text>
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
  shortcuts: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginBottom: space.md },
  shortcut: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md },
  cardInner: { padding: space.lg },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  flowLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  accountStrip: { paddingHorizontal: space.lg, gap: space.md },
  accountCard: { width: 158 },
  // A thin colour edge identifies the account without flooding the card.
  accountAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  accountInner: { padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  bookBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: space.xl },
});
