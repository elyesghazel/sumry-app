import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { BarSeries } from '../../src/components/charts';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Btn, Card, Divider, Empty, Field, Header, Meter, Section, Segment, ui } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
import { useDestructiveAction } from '../../src/components/ConfirmDialog';
import { useApp } from '../../src/store';
import { budgetPot, formatAmount, pctChange, type MatchType } from '../../src/core';
import { api } from '../../src/api';
import { categoryMonths } from '../../src/lib/derive';
import { usePreferences, useTheme } from '../../src/preferences';
import { categoryColor, space, type } from '../../src/theme';

const MATCH: [MatchType, string][] = [
  ['CONTAINS', 'contains'],
  ['STARTS_WITH', 'starts with'],
  ['EQUALS', 'equals'],
  ['REGEX', 'regex'],
];

/** One category: its trend, its budget, its rules and its entries. */
export default function CategoryDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { label } = useLocalSearchParams<{ label: string }>();
  const { categories, transactions, progress, rules, accounts, mutate } = useApp();
  const { prefs, mask, tick } = usePreferences();
  const toast = useToast();
  const destructive = useDestructiveAction();
  const [months, setMonths] = useState<'6' | '12'>('6');
  const [pattern, setPattern] = useState('');
  const [match, setMatch] = useState<MatchType>('CONTAINS');

  const category = categories.find((c) => c.label === label);
  const color = categoryColor(theme, label ?? '', category?.color);
  const series = useMemo(() => categoryMonths(transactions, label ?? '', Number(months)), [transactions, label, months]);
  const entries = useMemo(
    () =>
      transactions
        .filter((t) => (t.categoryLabel ?? 'Uncategorised') === label)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions, label],
  );
  const budget = progress.find((p) => p.categoryLabel === label);
  const ownRules = rules.filter((r) => r.categoryLabel === label);
  const accountName = new Map(accounts.map((a) => [a.id, a.accountName]));

  const thisMonth = series[series.length - 1]?.value ?? 0;
  const lastMonth = series[series.length - 2]?.value ?? 0;
  const full = series.slice(0, -1);
  const avg = full.length ? full.reduce((s, p) => s + p.value, 0) / full.length : 0;
  const change = pctChange(thisMonth, lastMonth);

  const addRule = async () => {
    if (!pattern.trim() || !label) return;
    try {
      await mutate((t) => api.createRule(t, { pattern: pattern.trim(), matchType: match, categoryLabel: label }));
      toast.success('Rule added', `“${pattern.trim()}” → ${label}`);
      setPattern('');
    } catch (e) {
      toast.error('Could not add rule', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <Screen>
      <Header
        title={label ?? 'Category'}
        subtitle={category ? `${category.categoryType === 'INCOME' ? 'income' : 'expense'}${category.parentGroup ? ` · ${category.parentGroup}` : ''}` : undefined}
        right={
          category ? (
            <Pressable onPress={() => router.push({ pathname: '/settings/category', params: { label: category.label } })} hitSlop={10}>
              <Ionicons name="create-outline" size={21} color={theme.textMuted} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={[ui.between, { paddingHorizontal: space.xl, alignItems: 'flex-end' }]}>
          <View>
            <Text style={[type.caption, { color: theme.textFaint }]}>THIS MONTH</Text>
            <Text style={[type.display, { color: theme.text, fontSize: 38 }]}>{mask(formatAmount(thisMonth), 'all')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.label, { color: theme.textMuted }]}>last month {mask(formatAmount(lastMonth), 'all')}</Text>
            <Text style={[type.label, { color: theme.textFaint }]}>avg {mask(formatAmount(avg), 'all')}/mo</Text>
            {change !== null ? (
              <Text style={[type.label, { color: change > 0 ? theme.negative : theme.positive }]}>
                {change > 0 ? '+' : '−'}
                {Math.abs(Math.round(change))}% vs last
              </Text>
            ) : null}
          </View>
        </View>

        <Section title="Trend" />
        <Card>
          <Segment<'6' | '12'> options={[['6', '6 months'], ['12', '12 months']]} value={months} onChange={setMonths} />
          <View style={{ marginTop: space.md }}>
            <BarSeries data={series.map((p) => ({ key: p.key, label: p.label, value: p.value }))} color={color} currency={prefs.currency} />
          </View>
        </Card>

        {budget ? (
          <>
            <Section title="Budget" action="Open →" onAction={() => router.push({ pathname: '/pot/[id]', params: { id: budget.budgetId, kind: 'budget' } })} />
            <Card>
              {(() => {
                const pot = budgetPot(budget);
                return (
                  <>
                    <View style={ui.between}>
                      <Text style={[type.label, { color: theme.textMuted }]}>{budget.period.toLowerCase()}</Text>
                      <Text style={[type.label, { color: pot.status === 'over' ? theme.negative : theme.text }]}>
                        {mask(formatAmount(pot.current), 'all')} / {formatAmount(pot.target)}
                      </Text>
                    </View>
                    <Meter ratio={pot.ratio} tone={pot.status === 'over' ? 'over' : pot.status === 'warn' ? 'warn' : 'ink'} style={{ marginTop: 6 }} />
                  </>
                );
              })()}
            </Card>
          </>
        ) : null}

        <Section title="Rules" detail={`${ownRules.length}`} />
        <Card padded={false}>
          {ownRules.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <View style={[ui.row, { opacity: r.isActive ? 1 : 0.5 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                    {MATCH.find((m) => m[0] === r.matchType)?.[1]} “{r.pattern}”
                  </Text>
                  <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>
                    {r.hits} hits{r.accountName ? ` · only ${r.accountName}` : ''} · priority {r.priority}
                  </Text>
                </View>
                <Btn small label={r.isActive ? 'On' : 'Off'} primary={r.isActive} onPress={() => void mutate((t) => api.updateRule(t, r.id, { isActive: !r.isActive }))} />
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    void destructive(
                      { title: 'Delete this rule?', message: `“${r.pattern}” stops sorting entries into ${r.categoryLabel}. Entries already sorted stay.`, confirmLabel: 'Delete' },
                      () => mutate((t) => api.deleteRule(t, r.id)),
                      { onError: (m) => toast.error('Could not delete', m) },
                    )
                  }
                >
                  <Ionicons name="trash-outline" size={17} color={theme.textFaint} />
                </Pressable>
              </View>
            </View>
          ))}
          {ownRules.length ? <Divider /> : null}
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Text style={[type.caption, { color: theme.textFaint }]}>NEW RULE · A NOTE THAT</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {MATCH.map(([k, l]) => (
                <Btn key={k} small label={l} primary={match === k} onPress={() => setMatch(k)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Field value={pattern} onChangeText={setPattern} placeholder="e.g. migros" autoCapitalize="none" style={{ flex: 1 }} />
              <Btn primary label="Add" disabled={!pattern.trim()} onPress={addRule} />
            </View>
          </View>
        </Card>

        <Section
          title="Entries"
          detail={`${entries.length}`}
          action="In Activity →"
          onAction={() => {
            tick();
            router.push({ pathname: '/activity', params: { category: label } });
          }}
        />
        <Card padded={false}>
          {entries.slice(0, 30).map((tx, i) => (
            <View key={tx.id}>
              {i > 0 ? <Divider inset={64} /> : null}
              <TransactionRow
                tx={tx}
                category={category}
                accountName={accountName.get(tx.userAccountId ?? '')}
                showAccount={accounts.length > 1}
                showDate
                onPress={() => router.push({ pathname: '/entry', params: { id: tx.id } })}
              />
            </View>
          ))}
          {entries.length === 0 ? <Empty text="No entries in this category yet." /> : null}
        </Card>
        {entries.length > 30 ? (
          <Text style={[type.caption, { color: theme.textFaint, textAlign: 'center', marginTop: space.sm }]}>Latest 30 shown.</Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
