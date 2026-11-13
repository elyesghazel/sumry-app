import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Delta } from '../../src/components/Delta';
import { Sparkline } from '../../src/components/charts';
import { Btn, Card, Divider, Meter, Section, Swatch } from '../../src/components/ui';
import { useApp } from '../../src/store';
import { usePreferences, useTheme } from '../../src/preferences';
import {
  accountDelta,
  addDays,
  dailyAllowance,
  dayOf,
  formatAmount,
  formatShortDate,
  isoDay,
  mergePots,
  needsYou,
  projectBalance,
  resolveRange,
  startOfDay,
  totals,
  type NeedsYouItem,
  type Occurrence,
} from '../../src/core';
import { useDeleteTransaction, usePlanActions } from '../../src/actions';
import { unsnoozed, useSnoozes } from '../../src/lib/snooze';
import { longToday } from '../../src/lib/dates';
import { categoryColor, radius, space, type } from '../../src/theme';

/**
 * Today answers three questions in order: can I spend, does anything need me, what is
 * coming. Everything the old overview showed stays here in compact form, and every figure
 * opens a screen with more detail.
 */
export default function Today() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, tick, hidden, reveal, mask, set } = usePreferences();
  const {
    accounts,
    categories,
    transactions,
    refreshing,
    refresh,
    error,
    safe,
    forecast,
    upcoming,
    progress,
    budgets,
    goals,
  } = useApp();
  const deleteTransaction = useDeleteTransaction();
  const plan = usePlanActions();
  const { snoozes, snooze, clear } = useSnoozes();

  const range = useMemo(() => resolveRange(prefs.timeframe), [prefs.timeframe]);
  const categoryByLabel = useMemo(() => new Map(categories.map((c) => [c.label, c])), [categories]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.accountName])), [accounts]);

  const allowance = useMemo(() => dailyAllowance(safe, transactions), [safe, transactions]);
  const committed = safe ? safe.upcomingExpenses + safe.upcomingTransfersOut : 0;
  const nextIncome = useMemo(
    () => (safe ? upcoming.find((o) => o.kind === 'INCOME' && dayOf(o.date) === safe.horizon.slice(0, 10)) : undefined),
    [safe, upcoming],
  );

  const netWorth = useMemo(() => accounts.reduce((s, a) => s + (a.baseBalance ?? a.currentBalance ?? 0), 0), [accounts]);
  const period = useMemo(() => totals(transactions, range), [transactions, range]);
  const netChange = useMemo(
    () => accounts.reduce((s, a) => s + accountDelta(a, transactions, range), 0),
    [accounts, transactions, range],
  );

  const inbox = useMemo(
    () => needsYou({ accounts, transactions, upcoming, progress, budgets }),
    [accounts, transactions, upcoming, progress, budgets],
  );
  const visibleInbox = useMemo(() => unsnoozed(inbox, snoozes), [inbox, snoozes]);
  const snoozedCount = inbox.length - visibleInbox.length;

  // Spending accounts drive the 14-day line, the same ones safe-to-spend looks at.
  const spendingAccounts = useMemo(() => {
    const ids = safe?.accountIds?.length ? new Set(safe.accountIds) : null;
    return accounts.filter((a) => (ids ? ids.has(a.id) : a.spending !== false));
  }, [accounts, safe]);
  const projection = useMemo(() => projectBalance(spendingAccounts, upcoming, 14), [spendingAccounts, upcoming]);

  const week = useMemo(() => {
    const today = startOfDay(new Date());
    const todayKey = isoDay(today);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i);
      return { key: isoDay(d), date: d, items: [] as Occurrence[], net: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const o of upcoming) {
      let k = dayOf(o.date);
      if (k < todayKey) k = todayKey;
      const slot = byKey.get(k);
      if (!slot) continue;
      slot.items.push(o);
      if (o.kind === 'INCOME') slot.net += o.amount;
      else if (o.kind !== 'TRANSFER_IN') slot.net -= o.amount;
    }
    return { days, net: days.reduce((s, d) => s + d.net, 0) };
  }, [upcoming]);

  const topBudgets = useMemo(() => mergePots(progress, []).slice(0, 3), [progress]);
  const goalCount = goals.filter((g) => g.isActive !== false).length;

  const recent = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const todayKey = isoDay(new Date());
    const todays = sorted.filter((t) => dayOf(t.date) === todayKey);
    return { title: todays.length ? 'Today' : 'Recent', rows: todays.length >= 3 ? todays.slice(0, 8) : sorted.slice(0, 5) };
  }, [transactions]);

  const hero = safe ? allowance.leftToday : netWorth;
  const meterTone = allowance.over ? 'over' : allowance.ratio >= 0.8 ? 'warn' : 'ok';

  const togglePrivacy = () => {
    tick();
    if (prefs.privacy === 'off') set('privacy', 'balances');
    else reveal();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
      >
        <View style={styles.top}>
          <Text style={[type.label, { color: theme.textFaint, flex: 1 }]}>{longToday()}</Text>
          <Pressable
            onPress={togglePrivacy}
            onLongPress={() => set('privacy', 'off')}
            hitSlop={8}
            style={[styles.chip, { backgroundColor: theme.keypad }]}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={13} color={theme.textMuted} />
            <Text style={[type.caption, { color: theme.textMuted, letterSpacing: 0.2 }]}>{hidden ? 'show' : 'hide'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              tick();
              router.push('/settings');
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={21} color={theme.textMuted} />
          </Pressable>
        </View>

        {error ? <Text style={[type.label, styles.error, { color: theme.negative }]}>{error}</Text> : null}

        {/* Can I spend? Today's allowance, refilled every morning. */}
        <Pressable
          onPress={() => {
            tick();
            router.push('/safe');
          }}
          style={styles.hero}
          accessibilityRole="button"
          accessibilityLabel="Safe to spend details"
        >
          <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
            {safe ? 'Safe to spend today' : 'Total balance'}
          </Text>
          <View style={styles.heroAmount}>
            <Text style={[type.display, { color: hero < 0 ? theme.negative : theme.text, fontSize: 50 }]}>
              {hero < 0 ? '−' : ''}
              {mask(formatAmount(hero))}
            </Text>
            <Text style={[type.label, { color: theme.textFaint, marginBottom: 10 }]}> {prefs.currency}</Text>
          </View>
          {safe ? (
            <>
              <Meter ratio={allowance.ratio} tone={meterTone} height={8} style={{ marginTop: space.md }} />
              <View style={[styles.between, { marginTop: 6 }]}>
                <Text style={[type.label, { color: theme.textMuted }]}>
                  {mask(formatAmount(allowance.spentToday), 'all')} spent of {mask(formatAmount(allowance.perDay))}
                </Text>
                <Text style={[type.label, { color: theme.textFaint }]} numberOfLines={1}>
                  {mask(formatAmount(safe.safeToSpend))} till {nextIncome ? nextIncome.name : formatShortDate(safe.horizon)} · {safe.daysToHorizon} d
                </Text>
              </View>
              <Text style={[type.caption, { color: theme.textFaint, marginTop: 3, letterSpacing: 0.2 }]}>
                {mask(formatAmount(safe.balance))} on hand − {mask(formatAmount(committed), 'all')} committed
              </Text>
            </>
          ) : null}
        </Pressable>

        {/* Account strip. Ink border = counts toward safe to spend. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accounts}>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                tick();
                router.push(`/account/${a.id}`);
              }}
              style={({ pressed }) => [
                styles.account,
                {
                  backgroundColor: theme.bgElevated,
                  borderColor: a.spending !== false ? theme.text : theme.hairline,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${a.accountName} account`}
            >
              <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
                {a.accountName}
              </Text>
              <Text style={[type.amount, { color: (a.currentBalance ?? 0) < 0 ? theme.negative : theme.text, fontSize: 16 }]}>
                {mask(formatAmount(a.currentBalance ?? 0))}
                {a.currency !== prefs.currency ? <Text style={[type.caption, { color: theme.textFaint }]}> {a.currency}</Text> : null}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Does anything need me? */}
        <Section
          title="Needs you"
          detail={visibleInbox.length ? String(visibleInbox.length) : undefined}
          detailColor={theme.negative}
          action={snoozedCount ? `${snoozedCount} snoozed · show` : undefined}
          onAction={clear}
        />
        <Card padded={false}>
          {visibleInbox.length ? (
            visibleInbox.map((item, i) => (
              <View key={item.id}>
                {i > 0 ? <Divider /> : null}
                <InboxRow
                  item={item}
                  mask={mask}
                  onSnooze={() => {
                    tick();
                    snooze(item.id, 1);
                  }}
                  onOpen={() => {
                    tick();
                    openItem(item, router);
                  }}
                  plan={plan}
                />
              </View>
            ))
          ) : (
            <View style={[styles.row, { paddingVertical: space.lg }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.positive} />
              <Text style={[type.label, { color: theme.textMuted }]}>All clear. Nothing needs you.</Text>
            </View>
          )}
        </Card>

        {/* What is coming? */}
        <Section
          title="Next 7 days"
          detail={week.net ? `${week.net > 0 ? '+' : '−'}${mask(formatAmount(week.net), 'all')}` : 'nothing planned'}
          action="Plan →"
          onAction={() => router.push('/plan')}
        />
        <View style={styles.week}>
          {week.days.map((d, i) => (
            <Pressable
              key={d.key}
              onPress={() => {
                tick();
                router.push({ pathname: '/plan', params: { day: d.key } });
              }}
              style={[
                styles.day,
                { backgroundColor: theme.bgElevated, borderColor: i === 0 ? theme.text : theme.hairline },
              ]}
            >
              <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0 }]}>
                {d.date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
              </Text>
              <Text style={[type.amount, { color: theme.text, fontSize: 15 }]}>{d.date.getDate()}</Text>
              {d.items.length ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                    {d.items.slice(0, 3).map((o) => (
                      <Swatch
                        key={`${o.plannedId}-${o.date}`}
                        size={5}
                        color={
                          o.kind === 'INCOME'
                            ? theme.positive
                            : o.overdue
                              ? theme.negative
                              : categoryColor(theme, o.categoryLabel ?? o.name, o.categoryColor)
                        }
                      />
                    ))}
                  </View>
                  <Text
                    style={{ fontSize: 9.5, color: d.net > 0 ? theme.positive : theme.textMuted, marginTop: 1 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {d.net > 0 ? '+' : d.net < 0 ? '−' : ''}
                    {mask(Math.abs(d.net) >= 1000 ? `${(Math.abs(d.net) / 1000).toFixed(1)}k` : formatAmount(d.net).replace(/\.00$/, ''), 'all')}
                  </Text>
                </>
              ) : null}
            </Pressable>
          ))}
        </View>
        {spendingAccounts.length ? (
          <Pressable onPress={() => router.push('/safe')} style={styles.projection}>
            <Sparkline values={projection.points.map((p) => p.balance)} color={theme.textMuted} height={30} />
            <View style={[styles.between, { marginTop: 2 }]}>
              <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>
                today {mask(formatAmount(projection.start))}
              </Text>
              <Text
                style={[
                  type.caption,
                  { color: projection.lowest.balance < 0 ? theme.negative : theme.textFaint, letterSpacing: 0.2 },
                ]}
              >
                lowest {projection.lowest.balance < 0 ? '−' : ''}
                {mask(formatAmount(projection.lowest.balance))} on {formatShortDate(projection.lowest.date)}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* The old overview's numbers, kept compact: net worth, the period, month end. */}
        <View style={styles.tiles}>
          <Pressable
            onPress={() => {
              tick();
              router.push('/insights');
            }}
            style={({ pressed }) => [styles.tile, { backgroundColor: theme.bgElevated, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>Net worth</Text>
            <Text style={[type.amount, { color: theme.text, fontSize: 19, marginTop: 4 }]} numberOfLines={1} adjustsFontSizeToFit>
              {netWorth < 0 ? '−' : ''}
              {mask(formatAmount(netWorth))}
            </Text>
            {hidden ? null : <Delta value={netChange} size="sm" showUnit={false} suffix={range.label.toLowerCase()} />}
            <Text style={[type.caption, { color: theme.textFaint, marginTop: 6, letterSpacing: 0.2 }]} numberOfLines={1}>
              in <Text style={{ color: theme.positive }}>{mask(formatAmount(period.income), 'all')}</Text> · out{' '}
              <Text style={{ color: theme.negative }}>{mask(formatAmount(period.expense), 'all')}</Text>
            </Text>
            <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
              net{' '}
              <Text style={{ color: period.net < 0 ? theme.negative : theme.positive }}>
                {period.net < 0 ? '−' : '+'}
                {mask(formatAmount(period.net), 'all')}
              </Text>
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              tick();
              router.push({ pathname: '/insights', params: { focus: 'month-end' } });
            }}
            style={({ pressed }) => [styles.tile, { backgroundColor: theme.bgElevated, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>Month end</Text>
            {forecast ? (
              <>
                <Text
                  style={[type.amount, { color: forecast.projectedNet < 0 ? theme.negative : theme.positive, fontSize: 19, marginTop: 4 }]}
                  numberOfLines={1}
                >
                  {forecast.projectedNet < 0 ? '−' : '+'}
                  {mask(formatAmount(forecast.projectedNet), 'all')}
                </Text>
                <Text style={[type.caption, { color: theme.textMuted, letterSpacing: 0.2 }]}>projected net</Text>
                <Text style={[type.caption, { color: theme.textFaint, marginTop: 6, letterSpacing: 0.2 }]} numberOfLines={1}>
                  spend {forecast.verdict === 'over' ? 'above' : forecast.verdict === 'under' ? 'below' : 'about'} usual
                </Text>
                <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
                  {mask(formatAmount(forecast.projectedSpend), 'all')} vs {mask(formatAmount(forecast.lastMonthSpend), 'all')} last
                </Text>
              </>
            ) : (
              <Text style={[type.label, { color: theme.textFaint, marginTop: 4 }]}>No forecast yet</Text>
            )}
          </Pressable>
        </View>

        <Section
          title={`Budgets · ${new Date().toLocaleDateString('en-GB', { month: 'long' })}`}
          detail={progress.length > 3 ? `top 3 of ${progress.length}` : undefined}
          action={progress.length || goalCount ? 'All pots →' : 'Set one'}
          onAction={() => router.push({ pathname: '/plan', params: { view: 'pots' } })}
        />
        <Card>
          {topBudgets.length ? (
            <View style={{ gap: space.md }}>
              {topBudgets.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    tick();
                    router.push({ pathname: '/pot/[id]', params: { id: p.id, kind: 'budget' } });
                  }}
                >
                  <View style={styles.between}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
                      <Swatch color={categoryColor(theme, p.name, categoryByLabel.get(p.name)?.color ?? p.color)} />
                      <Text style={[type.body, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </View>
                    <Text style={[type.label, { color: p.status === 'over' ? theme.negative : theme.textMuted }]}>
                      {mask(formatAmount(p.current), 'all')} / {formatAmount(p.target)}
                    </Text>
                  </View>
                  <Meter
                    ratio={p.ratio}
                    tone={p.status === 'over' ? 'over' : p.status === 'warn' ? 'warn' : 'ink'}
                    height={5}
                    style={{ marginTop: 6 }}
                  />
                  <Text style={[type.caption, { color: theme.textFaint, marginTop: 3, letterSpacing: 0.2 }]}>
                    {p.status === 'over'
                      ? `${mask(formatAmount(-p.remaining), 'all')} over`
                      : `${mask(formatAmount(p.remaining), 'all')} left · ${mask(formatAmount(p.kind === 'budget' ? p.budget.perDayLeft : 0), 'all')} a day for ${p.kind === 'budget' ? p.budget.daysLeft : 0} d`}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[type.label, { color: theme.textFaint }]}>
              No budgets yet. Put a cap on Essen gehen or Shopping and Today warns you the moment you pass it.
            </Text>
          )}
        </Card>

        <Section title={recent.title} action="All activity →" onAction={() => router.push('/activity')} />
        <Card padded={false}>
          {recent.rows.map((tx, i) => (
            <View key={tx.id}>
              {i > 0 ? <Divider inset={64} /> : null}
              <TransactionRow
                tx={tx}
                category={categoryByLabel.get(tx.categoryLabel ?? '')}
                accountName={accountName.get(tx.userAccountId ?? '')}
                showAccount={accounts.length > 1}
                onPress={() => router.push({ pathname: '/entry', params: { id: tx.id } })}
                onDelete={() => deleteTransaction(tx)}
              />
            </View>
          ))}
          {recent.rows.length === 0 ? (
            <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>Nothing logged yet. Tap + to start.</Text>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

type Router = ReturnType<typeof useRouter>;

function openItem(item: NeedsYouItem, router: Router) {
  switch (item.kind) {
    case 'overdue':
      router.push(`/planned/${item.occurrence.plannedId}`);
      return;
    case 'uncategorised':
      router.push({ pathname: '/activity', params: { uncategorised: '1' } });
      return;
    case 'budgetOver':
      router.push({ pathname: '/pot/[id]', params: { id: item.budget.budgetId, kind: 'budget' } });
      return;
    case 'reconcile':
      router.push({ pathname: '/account/[id]', params: { id: item.account.id, reconcile: '1' } });
      return;
    case 'monthClose':
      router.push({ pathname: '/statement', params: { month: item.month } });
  }
}

function InboxRow({
  item,
  mask,
  onSnooze,
  onOpen,
  plan,
}: {
  item: NeedsYouItem;
  mask: (s: string, level?: 'balances' | 'all') => string;
  onSnooze: () => void;
  onOpen: () => void;
  plan: ReturnType<typeof usePlanActions>;
}) {
  const theme = useTheme();
  let dot = theme.textFaint;
  let title = '';
  let sub = '';
  let action: React.ReactNode = null;

  switch (item.kind) {
    case 'overdue': {
      const o = item.occurrence;
      dot = theme.negative;
      title = `${o.name} · ${item.daysLate === 0 ? 'due today' : item.daysLate === 1 ? 'due yesterday' : `${item.daysLate} d late`}`;
      sub = `${o.kind === 'INCOME' ? '+' : '−'}${mask(formatAmount(o.amount), 'all')} · ${o.toAccountName ? `${o.accountName} → ${o.toAccountName}` : o.accountName}`;
      action = <Btn small primary label="Book" onPress={() => void plan.book(o)} />;
      break;
    }
    case 'uncategorised':
      dot = theme.accent;
      title = `${item.count} ${item.count === 1 ? 'entry' : 'entries'} without category`;
      sub = `${mask(formatAmount(item.total), 'all')} in total`;
      action = <Btn small label="Sort" onPress={onOpen} />;
      break;
    case 'budgetOver':
      dot = theme.negative;
      title = `${item.budget.categoryLabel} over budget`;
      sub = `${mask(formatAmount(item.over), 'all')} over · ${formatAmount(item.budget.spentAmount)} of ${formatAmount(item.budget.effectiveLimit)}`;
      action = <Btn small label="Look" onPress={onOpen} />;
      break;
    case 'reconcile':
      dot = theme.textFaint;
      title =
        item.daysSince === null
          ? `${item.account.accountName} never checked`
          : `${item.account.accountName} not checked for ${item.daysSince} d`;
      sub = `balance here ${mask(formatAmount(item.account.currentBalance))} · does the bank agree?`;
      action = <Btn small label={/cash|portemonnaie|bar/i.test(item.account.accountName) ? 'Count' : 'Check'} onPress={onOpen} />;
      break;
    case 'monthClose':
      dot = theme.accent;
      title = `${new Date(`${item.from}T12:00:00`).toLocaleDateString('en-GB', { month: 'long' })} closed`;
      sub = `spent ${mask(formatAmount(item.spent), 'all')}${item.change !== null ? ` · ${item.change > 0 ? '+' : '−'}${Math.abs(Math.round(item.change))}% vs month before` : ''}${item.topCategories.length ? ` · ${item.topCategories.map((c) => c.label).join(', ')}` : ''}${item.budgetsHit.length ? ` · ${item.budgetsHit.length} budget${item.budgetsHit.length === 1 ? '' : 's'} hit` : ''}`;
      action = <Btn small label="Statement" onPress={onOpen} />;
      break;
  }

  return (
    <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Pressable onPress={onOpen} style={{ flex: 1 }} accessibilityRole="button">
          <Text style={[type.label, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2, marginTop: 1 }]} numberOfLines={2}>
            {sub}
          </Text>
        </Pressable>
        {action}
        <Pressable onPress={onSnooze} hitSlop={8} accessibilityRole="button" accessibilityLabel="Snooze until tomorrow">
          <Ionicons name="alarm-outline" size={17} color={theme.textFaint} />
        </Pressable>
      </View>
      {item.kind === 'overdue' ? (
        <View style={styles.subActions}>
          <Btn small label="Skip" icon="play-skip-forward-outline" onPress={() => void plan.skip(item.occurrence)} />
          <Btn small label="+1 week" icon="arrow-forward-outline" onPress={() => void plan.postpone(item.occurrence, 7)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  error: { paddingHorizontal: space.xl, marginTop: space.sm },
  hero: { paddingHorizontal: space.xl, marginTop: space.lg },
  heroAmount: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xs },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  accounts: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.lg },
  account: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, minWidth: 96 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, paddingLeft: 20 },
  week: { flexDirection: 'row', gap: 4, paddingHorizontal: space.lg },
  day: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm + 2,
    paddingTop: 6,
    paddingBottom: 5,
    alignItems: 'center',
    minHeight: 64,
  },
  projection: { paddingHorizontal: space.xl, marginTop: space.md },
  tiles: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.xl },
  tile: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md },
});
