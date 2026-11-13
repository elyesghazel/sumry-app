import React, { useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Delta, DeltaPercent } from '../../src/components/Delta';
import { BarSeries, MonthColumns, RankedBars, Sparkline } from '../../src/components/charts';
import { Card, Chip, Divider, KV, Section, ui } from '../../src/components/ui';
import { useApp } from '../../src/store';
import {
  accountDelta,
  balanceSeries,
  categoryBreakdown,
  categoryMovers,
  formatAmount,
  frequentDescriptions,
  monthlySeries,
  pctChange,
  previousRange,
  resolveRange,
  spendBuckets,
  totals,
} from '../../src/core';
import { monthKey, monthTitle, shiftMonthKey } from '../../src/lib/dates';
import { TIMEFRAMES, usePreferences, useTheme } from '../../src/preferences';
import { categoryColor, radius, space, type } from '../../src/theme';

/**
 * How am I doing. The only place with a period picker; everything the old start page
 * compared lives here: period stats with deltas, the spend trend, where it goes, what moved
 * most, the balance line, month end in detail, the monthly statement.
 */
export default function Insights() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { prefs, set, tick, mask } = usePreferences();
  const { accounts, categories, transactions, refreshing, refresh, forecast, subscriptions } = useApp();
  const scroll = useRef<ScrollViewInstance>(null);
  const monthEndY = useRef(0);

  const range = useMemo(() => resolveRange(prefs.timeframe), [prefs.timeframe]);
  const prior = useMemo(() => previousRange(range), [range]);
  const now = useMemo(() => totals(transactions, range), [transactions, range]);
  const before = useMemo(() => totals(transactions, prior), [transactions, prior]);
  const buckets = useMemo(() => spendBuckets(transactions, range), [transactions, range]);
  const byCategory = useMemo(() => categoryBreakdown(transactions, range), [transactions, range]);
  const movers = useMemo(() => categoryMovers(transactions, range, 6), [transactions, range]);
  const months = useMemo(() => monthlySeries(transactions, 6), [transactions]);
  const frequent = useMemo(() => frequentDescriptions(transactions, range), [transactions, range]);
  const balance = useMemo(() => balanceSeries(accounts, transactions, range), [accounts, transactions, range]);
  const categoryByLabel = useMemo(() => new Map(categories.map((c) => [c.label, c])), [categories]);
  const perDay = now.expense / Math.max(1, range.days);
  const lastMonth = shiftMonthKey(monthKey(new Date()), -1);

  // Eight hues, never cycled: anything past the top eight folds into one neutral bar.
  const ranked = useMemo(() => {
    const top = byCategory.slice(0, 8).map((c) => ({
      label: c.label,
      value: c.value,
      share: c.share,
      meta: `${c.count}×`,
      color: categoryColor(theme, c.label, categoryByLabel.get(c.label)?.color),
    }));
    const rest = byCategory.slice(8);
    if (rest.length) {
      top.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((s, c) => s + c.value, 0),
        share: rest.reduce((s, c) => s + c.share, 0),
        meta: `${rest.reduce((s, c) => s + c.count, 0)}×`,
        color: theme.textFaint,
      });
    }
    return top;
  }, [byCategory, categoryByLabel, theme]);

  const visible = new Set<string>(prefs.cards);
  const show = (key: string) => visible.has(key);
  const bStart = balance[0]?.value ?? 0;
  const bEnd = balance[balance.length - 1]?.value ?? 0;

  return (
    <Screen>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
      >
        <View style={styles.head}>
          <Text style={[type.title, { color: theme.text }]}>Insights</Text>
          <Pressable onPress={() => router.push('/settings/insights')} hitSlop={8} accessibilityLabel="Choose cards">
            <Ionicons name="options-outline" size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.chipsRow}>
          {TIMEFRAMES.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              active={prefs.timeframe === t.key}
              onPress={() => {
                tick();
                set('timeframe', t.key);
              }}
            />
          ))}
        </ScrollView>

        {show('summary') ? (
          <Card style={{ marginTop: space.sm }}>
            <View style={styles.statGrid}>
              <Stat label="Spent" value={mask(formatAmount(now.expense), 'all')} foot={<DeltaPercent value={pctChange(now.expense, before.expense)} invert />} />
              <Stat label="Received" value={mask(formatAmount(now.income), 'all')} foot={<DeltaPercent value={pctChange(now.income, before.income)} />} />
              <Stat label="Net" value={`${now.net < 0 ? '−' : ''}${mask(formatAmount(now.net), 'all')}`} tone={now.net} foot={<Delta value={now.net - before.net} size="sm" showUnit={false} suffix="vs prev." />} />
              <Stat label="Per day" value={mask(formatAmount(perDay), 'all')} foot={<Text style={[type.caption, { color: theme.textFaint }]}>{now.count} entries</Text>} />
            </View>
          </Card>
        ) : null}

        {show('forecast') && forecast ? (
          <View
            onLayout={(e) => {
              monthEndY.current = e.nativeEvent.layout.y;
              if (focus === 'month-end') scroll.current?.scrollTo({ y: e.nativeEvent.layout.y - 20, animated: false });
            }}
          >
            <Section title="Month end" detail={`${forecast.daysLeft} days left`} />
            <Card>
              <KV label="Spent so far" value={mask(formatAmount(forecast.spentSoFar), 'all')} />
              <KV label="Received so far" value={mask(formatAmount(forecast.incomeSoFar), 'all')} />
              <KV label="Still planned out" value={mask(formatAmount(forecast.plannedExpensesRemaining), 'all')} />
              <KV label="Still planned in" value={mask(formatAmount(forecast.plannedIncomeRemaining), 'all')} />
              <KV
                label={`Everyday · ${forecast.daysLeft} d × ${formatAmount(forecast.baselineDailyPace)}`}
                value={mask(formatAmount(forecast.baselineDailyPace * forecast.daysLeft), 'all')}
              />
              <Divider inset={0} />
              <KV label="Projected spend" strong value={mask(formatAmount(forecast.projectedSpend), 'all')} />
              <KV label="Projected income" value={mask(formatAmount(forecast.projectedIncome), 'all')} />
              <KV
                label="Projected net"
                strong
                value={`${forecast.projectedNet < 0 ? '−' : '+'}${mask(formatAmount(forecast.projectedNet))}`}
                color={forecast.projectedNet < 0 ? theme.negative : theme.positive}
              />
              <Text style={[type.caption, { color: theme.textFaint, marginTop: 6, letterSpacing: 0.2 }]}>
                Pace {formatAmount(forecast.currentDailyPace)}/day vs usual {formatAmount(forecast.baselineDailyPace)} · spend{' '}
                {forecast.verdict === 'over' ? 'above' : forecast.verdict === 'under' ? 'below' : 'about'} the last three months · last month{' '}
                {formatAmount(forecast.lastMonthSpend)} · same month last year {formatAmount(forecast.sameMonthLastYearSpend)}
              </Text>
            </Card>
          </View>
        ) : null}

        {show('trend') ? (
          <>
            <Section title="Spending over time" detail={range.label.toLowerCase()} />
            <Card>
              <BarSeries data={buckets.map((b) => ({ key: b.key, label: b.label, value: b.value }))} color={theme.accent} currency={prefs.currency} />
            </Card>
          </>
        ) : null}

        {show('categories') ? (
          <>
            <Section title="Where it goes" />
            <Card>
              {byCategory.length ? (
                <RankedBars
                  currency={prefs.currency}
                  data={ranked}
                  onPress={(label) => (label.startsWith('Other (') ? undefined : router.push({ pathname: '/category/[label]', params: { label } }))}
                />
              ) : (
                <Text style={[type.label, { color: theme.textFaint }]}>Nothing spent in this period.</Text>
              )}
            </Card>
          </>
        ) : null}

        <Section title="Moved most" detail="vs previous period" />
        <Card>
          {movers.length ? (
            movers.map((m) => (
              <Pressable
                key={m.label}
                onPress={() => router.push({ pathname: '/category/[label]', params: { label: m.label } })}
                style={[ui.between, { paddingVertical: 5 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
                  <View style={[styles.swatch, { backgroundColor: categoryColor(theme, m.label, categoryByLabel.get(m.label)?.color) }]} />
                  <Text style={[type.body, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
                    {m.label}
                  </Text>
                </View>
                <Text style={[type.caption, { color: theme.textFaint }]}>
                  {mask(formatAmount(m.previous), 'all')} → {mask(formatAmount(m.current), 'all')}
                </Text>
                <View style={{ width: 92, alignItems: 'flex-end' }}>
                  <Delta value={m.delta} size="sm" invert showUnit={false} />
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={[type.label, { color: theme.textFaint }]}>Nothing changed much.</Text>
          )}
        </Card>

        <Section title="Balance" detail={`all accounts · ${range.label.toLowerCase()}`} />
        <Card>
          <View style={[ui.between, { marginBottom: space.sm }]}>
            <Text style={[type.amount, { color: theme.text }]}>{mask(formatAmount(bEnd))}</Text>
            {balance.length ? <Delta value={bEnd - bStart} size="sm" /> : null}
          </View>
          <Sparkline values={balance.map((p) => p.value)} color={theme.text} height={80} />
          {balance.length ? (
            <View style={[ui.between, { marginTop: space.xs }]}>
              <Text style={[type.caption, { color: theme.textFaint }]}>{balance[0].label}</Text>
              <Text style={[type.caption, { color: theme.textFaint }]}>{balance[balance.length - 1].label}</Text>
            </View>
          ) : null}
        </Card>

        {show('months') ? (
          <>
            <Section title="Month comparison" />
            <Card>
              <MonthColumns data={months} />
            </Card>
          </>
        ) : null}

        {show('accounts') ? (
          <>
            <Section title="Account movement" />
            <Card>
              {accounts.map((a) => (
                <Pressable key={a.id} onPress={() => router.push(`/account/${a.id}`)} style={[ui.between, { paddingVertical: 5 }]}>
                  <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                    {a.accountName}
                  </Text>
                  <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>{mask(formatAmount(a.currentBalance ?? 0))}</Text>
                  <View style={{ width: 92, alignItems: 'flex-end' }}>
                    <Delta value={accountDelta(a, transactions, range)} size="sm" showUnit={false} />
                  </View>
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

        {show('subscriptions') && subscriptions ? (
          <>
            <Section title="Subscriptions" action="All →" onAction={() => router.push({ pathname: '/plan', params: { view: 'subs' } })} />
            <Card>
              {subscriptions.subscriptions
                .filter((x) => x.active)
                .slice(0, 5)
                .map((x) => (
                  <KV key={x.name} label={`${x.name} · ${x.interval.toLowerCase()}`} value={`${mask(formatAmount(x.monthlyEquivalent), 'all')}/mo`} />
                ))}
              <Text style={[type.caption, { color: theme.textFaint, marginTop: 4, letterSpacing: 0.2 }]}>
                {subscriptions.activeCount} active · {mask(formatAmount(subscriptions.monthlyTotal), 'all')} a month · {mask(formatAmount(subscriptions.yearlyTotal), 'all')} a year
              </Text>
            </Card>
          </>
        ) : null}

        {show('top') ? (
          <>
            <Section title="Most frequent" />
            <Card>
              {frequent.length ? (
                frequent.map((f) => (
                  <Pressable key={f.label} onPress={() => router.push({ pathname: '/activity', params: { q: f.label } })} style={[ui.between, { paddingVertical: 5 }]}>
                    <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                      {f.label}
                    </Text>
                    <Text style={[type.caption, { color: theme.textFaint }]}>{f.count}×</Text>
                    <Text style={[type.amount, { color: theme.textMuted, fontSize: 15, minWidth: 70, textAlign: 'right' }]}>{mask(formatAmount(f.total), 'all')}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={[type.label, { color: theme.textFaint }]}>No repeated notes in this period.</Text>
              )}
            </Card>
          </>
        ) : null}

        <Section title="Monthly statement" />
        <Pressable
          onPress={() => {
            tick();
            router.push({ pathname: '/statement', params: { month: lastMonth } });
          }}
          style={({ pressed }) => [styles.statement, { backgroundColor: theme.bgElevated, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="document-text-outline" size={22} color={theme.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: theme.text }]}>{monthTitle(lastMonth)}</Text>
            <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>In, out, categories, budgets, accounts. Email it from there.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, foot, tone }: { label: string; value: string; foot?: React.ReactNode; tone?: number }) {
  const theme = useTheme();
  const colour = tone === undefined || Math.abs(tone) < 0.005 ? theme.text : tone > 0 ? theme.positive : theme.negative;
  return (
    <View style={styles.stat}>
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{label}</Text>
      <Text style={[type.amount, { color: colour, fontSize: 20, marginVertical: 4 }]}>{value}</Text>
      {foot}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', paddingVertical: space.sm },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  statement: {
    marginHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
