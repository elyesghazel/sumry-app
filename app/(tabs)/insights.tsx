import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { Delta, DeltaPercent } from '../../src/components/Delta';
import { BarSeries, MonthColumns, RankedBars } from '../../src/components/charts';
import { useApp } from '../../src/store';
import { api } from '../../src/api';
import { INSIGHT_CARDS, TIMEFRAMES, usePreferences, useTheme } from '../../src/preferences';
import {
  accountDelta,
  categoryBreakdown,
  frequentDescriptions,
  monthlySeries,
  pctChange,
  previousRange,
  resolveRange,
  spendBuckets,
  totals,
} from '../../src/analytics';
import { formatAmount } from '../../src/format';
import { categoryColor, radius, space, type } from '../../src/theme';

export default function Insights() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, tick, mask } = usePreferences();
  const { accounts, categories, transactions, budgets, progress, refreshing, refresh, mutate } =
    useApp();

  const range = useMemo(() => resolveRange(prefs.timeframe), [prefs.timeframe]);
  const prior = useMemo(() => previousRange(range), [range]);

  const now = useMemo(() => totals(transactions, range), [transactions, range]);
  const before = useMemo(() => totals(transactions, prior), [transactions, prior]);

  const buckets = useMemo(() => spendBuckets(transactions, range), [transactions, range]);
  const byCategory = useMemo(() => categoryBreakdown(transactions, range), [transactions, range]);
  const months = useMemo(() => monthlySeries(transactions, 6), [transactions]);
  const frequent = useMemo(() => frequentDescriptions(transactions, range), [transactions, range]);

  const categoryByLabel = useMemo(
    () => new Map(categories.map((c) => [c.label, c])),
    [categories],
  );

  const perDay = now.expense / Math.max(1, range.days);

  /**
   * The palette has eight hues and they are never cycled to invent a ninth, so anything
   * past the top eight folds into a single neutral "Other" bar rather than reusing a
   * colour that already means a different category.
   */
  const rankedCategories = useMemo(() => {
    const top = byCategory.slice(0, 8).map((c) => ({
      label: c.label,
      value: c.value,
      share: c.share,
      meta: `${c.count}\u00d7`,
      color: categoryColor(theme, c.label, categoryByLabel.get(c.label)?.color),
    }));
    const rest = byCategory.slice(8);
    if (rest.length) {
      top.push({
        label: `Other (${rest.length})`,
        value: rest.reduce((s, c) => s + c.value, 0),
        share: rest.reduce((s, c) => s + c.share, 0),
        meta: `${rest.reduce((s, c) => s + c.count, 0)}\u00d7`,
        color: theme.textFaint,
      });
    }
    return top;
  }, [byCategory, categoryByLabel, theme]);

  const visible = new Set(prefs.cards);
  const show = (key: string) => visible.has(key as never);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />
        }
      >
        <View style={styles.head}>
          <Text style={[type.title, { color: theme.text }]}>Insights</Text>
          <Pressable onPress={() => router.push('/settings/insights')} hitSlop={8}>
            <Ionicons name="options-outline" size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        {/* Timeframe drives every card below it. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
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
          <Card>
            <View style={styles.statGrid}>
              <Stat
                label="Spent"
                value={mask(formatAmount(now.expense), 'all')}
                foot={<DeltaPercent value={pctChange(now.expense, before.expense)} invert />}
              />
              <Stat
                label="Received"
                value={mask(formatAmount(now.income), 'all')}
                foot={<DeltaPercent value={pctChange(now.income, before.income)} />}
              />
              <Stat
                label="Net"
                value={`${now.net < 0 ? '−' : ''}${mask(formatAmount(now.net), 'all')}`}
                tone={now.net}
                foot={<Delta value={now.net} size="sm" showUnit={false} />}
              />
              <Stat
                label="Per day"
                value={mask(formatAmount(perDay), 'all')}
                foot={
                  <Text style={[type.caption, { color: theme.textFaint }]}>
                    {now.count} entries
                  </Text>
                }
              />
            </View>
          </Card>
        ) : null}

        {show('trend') ? (
          <Section title="Spending over time" />
        ) : null}
        {show('trend') ? (
          <Card>
            <BarSeries
              data={buckets.map((b) => ({ key: b.key, label: b.label, value: b.value }))}
              color={theme.accent}
              currency={prefs.currency}
            />
          </Card>
        ) : null}

        {show('categories') ? <Section title="By category" /> : null}
        {show('categories') ? (
          <Card>
            {byCategory.length ? (
              <RankedBars
                currency={prefs.currency}
                data={rankedCategories}
                onPress={(label) =>
                  router.push({ pathname: '/transactions', params: { q: label } })
                }
              />
            ) : (
              <Empty text="Nothing spent in this period." />
            )}
          </Card>
        ) : null}

        {show('months') ? <Section title="Month comparison" /> : null}
        {show('months') ? (
          <Card>
            <MonthColumns data={months} />
          </Card>
        ) : null}

        {show('accounts') ? <Section title="Account movement" /> : null}
        {show('accounts') ? (
          <Card>
            <View style={{ gap: space.md }}>
              {accounts.map((a) => (
                <View key={a.id} style={styles.rowBetween}>
                  <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                    {a.accountName}
                  </Text>
                  <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>
                    {mask(formatAmount(a.currentBalance ?? 0))}
                  </Text>
                  <View style={{ width: 96, alignItems: 'flex-end' }}>
                    <Delta value={accountDelta(a, transactions, range)} size="sm" />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {show('budgets') ? <Section title="Budgets" /> : null}
        {show('budgets') ? (
          <Budgets
            budgets={budgets}
            progress={progress}
            categories={categories}
            mutate={mutate}
          />
        ) : null}

        {show('top') ? <Section title="Most frequent" /> : null}
        {show('top') ? (
          <Card>
            {frequent.length ? (
              <View style={{ gap: space.md }}>
                {frequent.map((f) => (
                  <View key={f.label} style={styles.rowBetween}>
                    <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                      {f.label}
                    </Text>
                    <Text style={[type.caption, { color: theme.textFaint, marginRight: space.md }]}>
                      {f.count}×
                    </Text>
                    <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>
                      {formatAmount(f.total)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Empty text="No repeated notes in this period." />
            )}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Budgets live here because a budget is a spending question, not a separate feature. */
function Budgets({
  budgets,
  progress,
  categories,
  mutate,
}: {
  budgets: ReturnType<typeof useApp>['budgets'];
  progress: ReturnType<typeof useApp>['progress'];
  categories: ReturnType<typeof useApp>['categories'];
  mutate: ReturnType<typeof useApp>['mutate'];
}) {
  const theme = useTheme();
  const { prefs } = usePreferences();
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [limit, setLimit] = useState('');

  const progressByLabel = useMemo(
    () => new Map(progress.map((p) => [p.categoryLabel, p])),
    [progress],
  );

  const budgetable = categories.filter(
    (c) => c.categoryType === 'EXPENSE' && !budgets.some((b) => b.categoryLabel === c.label),
  );

  const add = async () => {
    const value = Number.parseFloat(limit);
    if (!category || !Number.isFinite(value) || value <= 0) return;
    try {
      await mutate((t) => api.createBudget(t, category, value));
      setAdding(false);
      setCategory(null);
      setLimit('');
    } catch (e) {
      Alert.alert('Could not add budget', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const remove = (id: string, label: string) =>
    Alert.alert('Remove budget?', label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          mutate((t) => api.deleteBudget(t, id)).catch((e) =>
            Alert.alert('Could not remove', e instanceof Error ? e.message : 'Unknown error'),
          ),
      },
    ]);

  return (
    <>
      {budgets.length ? (
        <Card>
          <View style={{ gap: space.lg }}>
            {budgets.map((b) => {
              const spent = progressByLabel.get(b.categoryLabel)?.spentAmount ?? 0;
              const pct = b.limitAmount > 0 ? spent / b.limitAmount : 1;
              const over = pct > 1;
              return (
                <Pressable key={b.id} onLongPress={() => remove(b.id, b.categoryLabel)}>
                  <View style={styles.rowBetween}>
                    <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                      {b.categoryLabel}
                    </Text>
                    <Text style={[type.label, { color: over ? theme.negative : theme.textMuted }]}>
                      {formatAmount(spent)} / {formatAmount(b.limitAmount)} {prefs.currency}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.keypad, marginTop: 6 }]}>
                    <View
                      style={{
                        width: `${Math.max(2, Math.min(100, pct * 100))}%`,
                        height: '100%',
                        borderRadius: radius.pill,
                        backgroundColor: over
                          ? theme.negative
                          : pct > 0.8
                            ? theme.accent
                            : theme.positive,
                      }}
                    />
                  </View>
                  {over ? (
                    <Text style={[type.caption, { color: theme.negative, marginTop: 4 }]}>
                      {formatAmount(spent - b.limitAmount)} over
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {adding ? (
        <Card>
          <View style={{ gap: space.md }}>
            <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
              Category
            </Text>
            <View style={styles.wrap}>
              {budgetable.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  active={category === c.label}
                  onPress={() => setCategory(c.label)}
                />
              ))}
            </View>
            <TextInput
              value={limit}
              onChangeText={setLimit}
              placeholder="Monthly limit"
              placeholderTextColor={theme.textFaint}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pressable
                onPress={() => setAdding(false)}
                style={[styles.action, { borderColor: theme.hairline }]}
              >
                <Text style={[type.label, { color: theme.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={add}
                style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text }]}
              >
                <Text style={[type.label, { color: theme.bg }]}>Add budget</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={[styles.addRow, { borderColor: theme.hairline }]}
        >
          <Ionicons name="add" size={18} color={theme.textMuted} />
          <Text style={[type.label, { color: theme.textMuted }]}>Add a budget</Text>
        </Pressable>
      )}
      {budgets.length ? <Hint text="Long-press a budget to remove it." /> : null}
    </>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <Glass style={styles.card}>
      <View style={styles.cardInner}>{children}</View>
    </Glass>
  );
}

function Section({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        type.caption,
        {
          color: theme.textFaint,
          textTransform: 'uppercase',
          paddingHorizontal: space.xl,
          marginTop: space.xl,
          marginBottom: space.md,
        },
      ]}
    >
      {title}
    </Text>
  );
}

function Stat({
  label,
  value,
  foot,
  tone,
}: {
  label: string;
  value: string;
  foot?: React.ReactNode;
  /** Signed figures colour by direction; plain totals stay neutral. */
  tone?: number;
}) {
  const theme = useTheme();
  const colour =
    tone === undefined || Math.abs(tone) < 0.005
      ? theme.text
      : tone > 0
        ? theme.positive
        : theme.negative;
  return (
    <View style={styles.stat}>
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
        {label}
      </Text>
      <Text style={[type.amount, { color: colour, fontSize: 20, marginVertical: 4 }]}>
        {value}
      </Text>
      {foot}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.text : theme.keypad,
          borderColor: active ? theme.text : theme.hairline,
        },
      ]}
    >
      <Text style={[type.label, { color: active ? theme.bg : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text style={[type.label, { color: theme.textFaint, textAlign: 'center' }]}>{text}</Text>
  );
}

function Hint({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        type.caption,
        { color: theme.textFaint, paddingHorizontal: space.xl, marginTop: space.sm },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.md },
  card: { marginHorizontal: space.lg },
  cardInner: { padding: space.lg },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', paddingVertical: space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
