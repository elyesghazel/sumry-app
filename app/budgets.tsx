import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Glass } from '../src/components/Glass';
import { useToast } from '../src/components/Toast';
import { useDestructiveAction } from '../src/components/ConfirmDialog';
import { useApp } from '../src/store';
import { Budget, BudgetPeriod, formatAmount } from '../src/core';
import { api } from '../src/api';
import { usePreferences, useTheme } from '../src/preferences';
import { categoryColor, radius, space, type } from '../src/theme';

const PERIODS: { key: BudgetPeriod; label: string }[] = [
  { key: 'WEEKLY', label: 'Weekly' },
  { key: 'MONTHLY', label: 'Monthly' },
  { key: 'YEARLY', label: 'Yearly' },
];

/** Envelopes with a period, a start day and rollover; progress reads as pace, not just a total. */
export default function Budgets() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, mask } = usePreferences();
  const { budgets, progress, categories, refreshing, refresh, mutate } = useApp();
  const toast = useToast();
  const confirmDestructive = useDestructiveAction();
  const [editing, setEditing] = useState<Budget | null | 'new'>(null);

  const byId = useMemo(() => new Map(progress.map((p) => [p.budgetId, p])), [progress]);
  const categoryByLabel = useMemo(() => new Map(categories.map((c) => [c.label, c])), [categories]);
  // Overspent envelopes first, furthest over on top, then the rest by how full they are.
  const sorted = useMemo(() => {
    const fill = (b: Budget) => {
      const p = byId.get(b.id);
      return p && p.effectiveLimit > 0 ? p.spentAmount / p.effectiveLimit : 0;
    };
    const over = (b: Budget) => {
      const p = byId.get(b.id);
      return p ? p.spentAmount - p.effectiveLimit : 0;
    };
    return [...budgets].sort((a, b) =>
      over(a) > 0 || over(b) > 0 ? over(b) - over(a) : fill(b) - fill(a),
    );
  }, [budgets, byId]);

  const remove = (b: Budget) =>
    void confirmDestructive(
      { title: `Remove the ${b.categoryLabel} budget?`, message: 'Its entries are not affected.', confirmLabel: 'Remove' },
      () => mutate((t) => api.deleteBudget(t, b.id)),
      { onSuccess: () => { setEditing(null); toast.success('Removed', b.categoryLabel); }, onError: (m) => toast.error('Could not remove', m) },
    );

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.title, { color: theme.text }]}>Budgets</Text>
        <Pressable onPress={() => setEditing('new')} hitSlop={10}>
          <Ionicons name="add" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl, gap: space.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <Editor budget={editing === 'new' ? null : editing} onDone={() => setEditing(null)} onRemove={editing === 'new' ? undefined : () => remove(editing)} />
        ) : null}

        {sorted.map((b) => {
          const p = byId.get(b.id);
          const ratio = p && p.effectiveLimit > 0 ? p.spentAmount / p.effectiveLimit : 0;
          const color = categoryColor(theme, b.categoryLabel, categoryByLabel.get(b.categoryLabel)?.color ?? b.categoryColor);
          return (
            <Glass key={b.id} style={styles.card}>
              <Pressable onPress={() => setEditing(b)} style={styles.cardInner}>
                <View style={styles.between}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={[styles.swatch, { backgroundColor: color }]} />
                    <Text style={[type.label, { color: theme.text }]}>{b.categoryLabel}</Text>
                  </View>
                  {p ? (
                    <Text style={[type.caption, { color: p.pace === 'over' ? theme.negative : p.pace === 'under' ? theme.positive : theme.textFaint }]}>
                      {p.pace === 'over' ? 'OVER PACE' : p.pace === 'under' ? 'UNDER PACE' : 'ON PACE'}
                    </Text>
                  ) : null}
                </View>
                {p ? (
                  <>
                    <View style={[styles.between, { alignItems: 'baseline', marginTop: 8 }]}>
                      <Text style={[type.display, { color: theme.text, fontSize: 30 }]}>{mask(formatAmount(p.spentAmount), 'all')}</Text>
                      <Text style={[type.label, { color: theme.textMuted }]}>
                        of {formatAmount(p.effectiveLimit)}{p.carry ? ` (${p.carry > 0 ? '+' : '−'}${formatAmount(p.carry)} carried)` : ''}
                      </Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.keypad }]}>
                      <View style={[styles.fill, { width: `${Math.max(2, Math.min(100, ratio * 100))}%`, backgroundColor: p.pace === 'over' ? theme.negative : p.pace === 'on' ? theme.accent : theme.text }]} />
                    </View>
                    <Text style={[type.caption, { color: theme.textFaint, marginTop: 6 }]}>
                      {p.periodStart.slice(5)} – {p.periodEnd.slice(5)} · {p.daysLeft} days left · {p.remaining >= 0 ? `${formatAmount(p.perDayLeft)}/day left` : `${formatAmount(-p.remaining)} over`}
                      {b.rollover ? ' · rolls over' : ''}
                    </Text>
                  </>
                ) : null}
              </Pressable>
            </Glass>
          );
        })}
        {!budgets.length && !editing ? (
          <Text style={[type.label, { color: theme.textFaint, padding: space.xl }]}>
            No budgets yet. A cap on Lebensmittel or Restaurant is where most people start — tap + to add one.
          </Text>
        ) : null}
        {budgets.length ? <Text style={[type.caption, { color: theme.textFaint, paddingHorizontal: space.xl }]}>Tap a budget to edit it. Amounts in {prefs.currency}.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Editor({ budget, onDone, onRemove }: { budget: Budget | null; onDone: () => void; onRemove?: () => void }) {
  const theme = useTheme();
  const { prefs } = usePreferences();
  const { budgets, categories, mutate } = useApp();
  const toast = useToast();
  const taken = new Set(budgets.map((b) => b.categoryLabel));
  const [category, setCategory] = useState<string | null>(budget?.categoryLabel ?? null);
  const [limit, setLimit] = useState(budget ? budget.limitAmount.toFixed(2) : '');
  const [period, setPeriod] = useState<BudgetPeriod>(budget?.period ?? 'MONTHLY');
  const [rollover, setRollover] = useState(budget?.rollover ?? false);
  const [startDay, setStartDay] = useState(String(budget?.startDay ?? 1));
  const [busy, setBusy] = useState(false);
  const value = Number.parseFloat(limit.replace(',', '.'));
  const valid = value > 0 && category;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const sd = Math.min(28, Math.max(1, Number.parseInt(startDay) || 1));
      if (budget) await mutate((t) => api.updateBudget(t, budget.id, { limitAmount: value, period, rollover, startDay: sd }));
      else await mutate((t) => api.createBudget(t, { categoryLabel: category!, maxAmount: value, period, rollover, startDay: sd }));
      toast.success('Budget saved', `${category} · ${prefs.currency} ${formatAmount(value)}`);
      onDone();
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };
  const field = { color: theme.text, backgroundColor: theme.bgElevated, borderColor: theme.hairline };

  return (
    <Glass style={styles.card}>
      <View style={[styles.cardInner, { gap: space.md }]}>
        {!budget ? (
          <View style={styles.wrap}>
            {categories.filter((c) => c.categoryType === 'EXPENSE' && !taken.has(c.label)).sort((a, b) => a.label.localeCompare(b.label)).map((c) => (
              <Pressable key={c.id} onPress={() => setCategory(c.label)} style={[styles.pill, { backgroundColor: category === c.label ? theme.text : theme.keypad, borderColor: category === c.label ? theme.text : theme.hairline }]}>
                <Text style={[type.label, { color: category === c.label ? theme.bgElevated : theme.textMuted }]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[type.title, { color: theme.text, fontSize: 20 }]}>{budget.categoryLabel}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput value={limit} onChangeText={setLimit} placeholder={`Limit per period · ${prefs.currency}`} placeholderTextColor={theme.textFaint} keyboardType="decimal-pad" style={[styles.input, field, { flex: 1 }]} />
          {period === 'MONTHLY' ? <TextInput value={startDay} onChangeText={setStartDay} placeholder="Day" placeholderTextColor={theme.textFaint} keyboardType="number-pad" style={[styles.input, field, { width: 74 }]} /> : null}
        </View>
        <View style={[styles.segment, { borderColor: theme.hairline }]}>
          {PERIODS.map((p) => (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[styles.segmentItem, period === p.key ? { backgroundColor: theme.text } : null]}>
              <Text style={[type.label, { color: period === p.key ? theme.bgElevated : theme.textMuted }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.between]}>
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: theme.text }]}>Roll over</Text>
            <Text style={[type.caption, { color: theme.textFaint }]}>Unspent (or overspent) money carries into the next period</Text>
          </View>
          <Switch value={rollover} onValueChange={setRollover} trackColor={{ true: theme.accent, false: theme.keypad }} thumbColor={theme.bgElevated} />
        </View>
        {period === 'MONTHLY' ? <Text style={[type.caption, { color: theme.textFaint }]}>THE MONTH STARTS ON DAY {startDay || '1'} — SET IT TO PAYDAY</Text> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {onRemove ? (
            <Pressable onPress={onRemove} style={[styles.action, { borderColor: theme.negative }]}>
              <Text style={[type.label, { color: theme.negative }]}>Remove</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onDone} style={[styles.action, { borderColor: theme.hairline }]}>
            <Text style={[type.label, { color: theme.textMuted }]}>Cancel</Text>
          </Pressable>
          <Pressable onPress={save} disabled={!valid || busy} style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text, opacity: valid && !busy ? 1 : 0.4 }]}>
            <Text style={[type.label, { color: theme.bgElevated }]}>{busy ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.md },
  card: { marginHorizontal: space.lg },
  cardInner: { padding: space.lg },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 2 },
  action: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
});
