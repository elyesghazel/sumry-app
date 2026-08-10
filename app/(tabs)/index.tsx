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
import { formatAmount } from '../../src/format';
import { categoryColor, radius, space, type } from '../../src/theme';

export default function Overview() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, tick, hidden, reveal, mask } = usePreferences();
  const { accounts, categories, transactions, refreshing, refresh, error } = useApp();

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
    () => accounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0),
    [accounts],
  );

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

        {/* Net worth — the one number worth showing large. */}
        <View style={styles.hero}>
          <Pressable onPress={cycleTimeframe} hitSlop={8} style={styles.timeframeRow}>
            <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
              Total balance
            </Text>
            <View style={[styles.timeframeChip, { backgroundColor: theme.keypad }]}>
              <Text style={[type.caption, { color: theme.textMuted }]}>{range.label}</Text>
              <Ionicons name="chevron-down" size={11} color={theme.textFaint} />
            </View>
          </Pressable>

          {/* Tapping the balance reveals it; it re-hides as soon as the app is backgrounded. */}
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
            <Text style={[type.display, { color: theme.text }]}>
              {mask(formatAmount(netWorth))}
            </Text>
            <Text style={[type.body, { color: theme.textFaint, marginBottom: 8 }]}>
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

          <View style={{ marginTop: space.xs }}>
            {hidden ? (
              <Text style={[type.label, { color: theme.textFaint }]}>
                Hidden · tap to show
              </Text>
            ) : (
              <Delta value={netChange} suffix={`in ${range.label.toLowerCase()}`} />
            )}
          </View>
        </View>

        {/* Spending shape over the window. */}
        {trend.some((v) => v > 0) ? (
          <Glass style={styles.card}>
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
  empty: { alignItems: 'center', paddingVertical: space.xl },
});
