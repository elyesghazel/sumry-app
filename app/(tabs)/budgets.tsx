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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { useApp } from '../../src/store';
import { api } from '../../src/api';
import { formatAmount, formatMonthLabel, isTransfer, sameMonth, signOf } from '../../src/format';
import { radius, space, type, useTheme } from '../../src/theme';

export default function Budgets() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { budgets, progress, categories, transactions, refreshing, refresh, mutate } = useApp();

  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState('');

  const progressByLabel = useMemo(
    () => new Map(progress.map((p) => [p.categoryLabel, p])),
    [progress],
  );

  // Where the month's money actually went, budget or not.
  const spendByCategory = useMemo(() => {
    const now = new Date();
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      if (isTransfer(tx.kind) || signOf(tx.kind) > 0) continue;
      if (!sameMonth(new Date(tx.date), now)) continue;
      const label = tx.categoryLabel ?? 'Uncategorised';
      totals.set(label, (totals.get(label) ?? 0) + tx.amount);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const monthTotal = spendByCategory.reduce((s, [, v]) => s + v, 0);

  const budgetable = categories.filter(
    (c) => c.categoryType === 'EXPENSE' && !budgets.some((b) => b.categoryLabel === c.label),
  );

  const addBudget = async () => {
    const limit = Number.parseFloat(newLimit);
    if (!newCategory || !Number.isFinite(limit) || limit <= 0) return;
    try {
      await mutate((t) => api.createBudget(t, newCategory, limit));
      setAdding(false);
      setNewCategory(null);
      setNewLimit('');
    } catch (e) {
      Alert.alert('Could not add budget', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const removeBudget = (id: string, label: string) => {
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
  };

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
          <Text style={[type.title, { color: theme.text }]}>Budgets</Text>
          <Text style={[type.label, { color: theme.textFaint }]}>
            {formatMonthLabel(new Date())}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
            Spent this month
          </Text>
          <Text style={[type.display, { color: theme.text, fontSize: 34, marginTop: 4 }]}>
            {formatAmount(monthTotal)}
          </Text>
        </View>

        {budgets.length > 0 ? (
          <Glass style={styles.card}>
            <View style={{ padding: space.lg, gap: space.lg }}>
              {budgets.map((b) => {
                const p = progressByLabel.get(b.categoryLabel);
                const spent = p?.spentAmount ?? 0;
                const pct = b.limitAmount > 0 ? spent / b.limitAmount : 1;
                const over = pct > 1;
                return (
                  <Pressable key={b.id} onLongPress={() => removeBudget(b.id, b.categoryLabel)}>
                    <View style={styles.budgetHead}>
                      <Text style={[type.body, { color: theme.text }]}>{b.categoryLabel}</Text>
                      <Text style={[type.label, { color: over ? theme.negative : theme.textMuted }]}>
                        {formatAmount(spent)} / {formatAmount(b.limitAmount)}
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.keypad }]}>
                      <View
                        style={[
                          styles.fill,
                          {
                            width: `${Math.max(2, Math.min(100, pct * 100))}%`,
                            backgroundColor: over
                              ? theme.negative
                              : pct > 0.8
                                ? theme.accent
                                : theme.positive,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Glass>
        ) : null}

        {adding ? (
          <Glass style={[styles.card, { marginTop: space.md }]}>
            <View style={{ padding: space.lg, gap: space.md }}>
              <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
                Category
              </Text>
              <View style={styles.wrap}>
                {budgetable.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setNewCategory(c.label)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: newCategory === c.label ? theme.text : theme.keypad,
                        borderColor: newCategory === c.label ? theme.text : theme.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        type.label,
                        { color: newCategory === c.label ? theme.bg : theme.textMuted },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={newLimit}
                onChangeText={setNewLimit}
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
                  onPress={addBudget}
                  style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text }]}
                >
                  <Text style={[type.label, { color: theme.bg }]}>Add budget</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            style={[styles.addRow, { borderColor: theme.hairline }]}
          >
            <Ionicons name="add" size={18} color={theme.textMuted} />
            <Text style={[type.label, { color: theme.textMuted }]}>Add a budget</Text>
          </Pressable>
        )}

        {/* Where the money went, budgeted or not. */}
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
          By category
        </Text>
        <Glass style={styles.card}>
          <View style={{ padding: space.lg, gap: space.md }}>
            {spendByCategory.map(([label, value]) => (
              <View key={label}>
                <View style={styles.budgetHead}>
                  <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>
                    {formatAmount(value)}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: theme.keypad }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.max(2, (value / (monthTotal || 1)) * 100)}%`,
                        backgroundColor: theme.textFaint,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
            {spendByCategory.length === 0 ? (
              <Text style={[type.label, { color: theme.textFaint, textAlign: 'center' }]}>
                Nothing spent this month.
              </Text>
            ) : null}
          </View>
        </Glass>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalRow: { paddingHorizontal: space.xl, marginTop: space.lg, marginBottom: space.xl },
  card: { marginHorizontal: space.lg },
  budgetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
    gap: space.md,
  },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
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
    marginTop: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
