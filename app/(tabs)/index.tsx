import React, { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { TransactionRow } from '../../src/components/TransactionRow';
import { useApp } from '../../src/store';
import {
  CURRENCY,
  formatAmount,
  formatMonthLabel,
  isTransfer,
  sameMonth,
  signOf,
} from '../../src/format';
import { radius, space, type, useTheme } from '../../src/theme';

export default function Overview() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accounts, categories, transactions, refreshing, refresh, error } = useApp();

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

  // This month's in/out across every account. Transfers are excluded: moving money
  // between your own accounts is not income and not spending.
  const month = useMemo(() => {
    const now = new Date();
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (isTransfer(tx.kind)) continue;
      if (!sameMonth(new Date(tx.date), now)) continue;
      if (signOf(tx.kind) > 0) income += tx.amount;
      else expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [transactions],
  );

  const flowMax = Math.max(month.income, month.expense, 1);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.textMuted}
          />
        }
      >
        {error ? (
          <Text style={[type.label, styles.error, { color: theme.negative }]}>{error}</Text>
        ) : null}

        {/* Net worth — the one number worth showing large. */}
        <View style={styles.hero}>
          <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
            Total balance
          </Text>
          <View style={styles.heroAmount}>
            <Text style={[type.display, { color: theme.text }]}>{formatAmount(netWorth)}</Text>
            <Text style={[type.body, { color: theme.textFaint, marginBottom: 8 }]}>
              {' '}
              {CURRENCY}
            </Text>
          </View>
          <Text style={[type.label, { color: theme.textMuted }]}>
            {formatMonthLabel(new Date())} · {month.net >= 0 ? '+' : '−'}
            {formatAmount(month.net)} this month
          </Text>
        </View>

        {/* In vs out, as two proportional bars. Easier to read than two more numbers. */}
        <Glass style={styles.card}>
          <View style={styles.cardInner}>
            <FlowBar
              label="In"
              amount={month.income}
              fraction={month.income / flowMax}
              color={theme.positive}
            />
            <View style={{ height: space.lg }} />
            <FlowBar
              label="Out"
              amount={month.expense}
              fraction={month.expense / flowMax}
              color={theme.negative}
            />
          </View>
        </Glass>

        {/* Accounts */}
        <SectionHeading title="Accounts" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountStrip}
        >
          {accounts.map((a) => (
            <Glass key={a.id} radiusSize={radius.md} style={styles.accountCard}>
              <View style={styles.accountInner}>
                <Text
                  style={[type.label, { color: theme.textMuted }]}
                  numberOfLines={1}
                >
                  {a.accountName}
                </Text>
                <Text style={[type.amount, { color: theme.text, fontSize: 19, marginTop: 6 }]}>
                  {formatAmount(a.currentBalance ?? 0)}
                </Text>
              </View>
            </Glass>
          ))}
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
  return (
    <View>
      <View style={styles.flowHeader}>
        <Text style={[type.label, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[type.amount, { color: theme.text }]}>{formatAmount(amount)}</Text>
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
  heroAmount: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.xs },
  card: { marginHorizontal: space.lg },
  cardInner: { padding: space.lg },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
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
  accountCard: { width: 150 },
  accountInner: { padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  empty: { alignItems: 'center', paddingVertical: space.xl },
});
