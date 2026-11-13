import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { TransactionRow } from '../../src/components/TransactionRow';
import { CategoryPicker } from '../../src/components/CategoryPicker';
import { Btn, Chip, Field } from '../../src/components/ui';
import { useApp } from '../../src/store';
import {
  formatAmount,
  groupByDay,
  isTransfer,
  isoDay,
  resolveRange,
  signOf,
  type SearchParams,
  type Transaction,
} from '../../src/core';
import { api } from '../../src/api';
import { useDeleteTransaction } from '../../src/actions';
import { useToast } from '../../src/components/Toast';
import type { Timeframe } from '../../src/preferences';
import { usePreferences, useTheme } from '../../src/preferences';
import { radius, space, type } from '../../src/theme';

const PERIODS: { key: Timeframe; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '30d', label: '30 days' },
  { key: '3m', label: '3 months' },
  { key: 'year', label: 'This year' },
];

type Kind = '' | 'EXPENSE' | 'INCOME' | 'TRANSFER';
const KINDS: { key: Kind; label: string }[] = [
  { key: '', label: 'All kinds' },
  { key: 'EXPENSE', label: 'Out' },
  { key: 'INCOME', label: 'In' },
  { key: 'TRANSFER', label: 'Transfers' },
];

/** Category filter value meaning "no category". */
const NONE = '__none__';

/**
 * Everything that happened, grouped by day. Search and the filters go through the
 * backend's /search (with sums); the list falls back to filtering the loaded entries when
 * that fails. Long-press a row to select several and recategorise them in one go.
 */
export default function Activity() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accounts, categories, transactions, refreshing, refresh, token, mutate } = useApp();
  const { prefs, tick, mask } = usePreferences();
  const toast = useToast();
  const deleteTransaction = useDeleteTransaction();

  const params = useLocalSearchParams<{ q?: string; account?: string; category?: string; uncategorised?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [accountId, setAccountId] = useState<string | null>(params.account ?? null);
  const [category, setCategory] = useState<string | null>(params.uncategorised ? NONE : (params.category ?? null));
  const [period, setPeriod] = useState<Timeframe | null>(null);
  const [kind, setKind] = useState<Kind>('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [picking, setPicking] = useState<'filter' | 'bulk' | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);

  // Arriving again with new params (from Today, an account, a category) resets the filter.
  useEffect(() => {
    if (params.q !== undefined) setQuery(params.q);
    if (params.account !== undefined) setAccountId(params.account || null);
    if (params.category !== undefined) setCategory(params.category || null);
    if (params.uncategorised) setCategory(NONE);
  }, [params.q, params.account, params.category, params.uncategorised]);

  const categoryByLabel = useMemo(() => new Map(categories.map((c) => [c.label, c])), [categories]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.accountName])), [accounts]);
  const window = useMemo(() => (period ? resolveRange(period) : null), [period]);
  const minN = Number.parseFloat(min.replace(',', '.'));
  const maxN = Number.parseFloat(max.replace(',', '.'));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (accountId && tx.userAccountId !== accountId) return false;
      if (category === NONE ? tx.categoryLabel || isTransfer(tx.kind) : category && tx.categoryLabel !== category) return false;
      if (kind === 'TRANSFER' ? !isTransfer(tx.kind) : kind && tx.kind !== kind) return false;
      if (Number.isFinite(minN) && tx.amount < minN) return false;
      if (Number.isFinite(maxN) && tx.amount > maxN) return false;
      if (window) {
        const t = new Date(tx.date).getTime();
        if (t < window.from.getTime() || t > window.to.getTime()) return false;
      }
      if (!needle) return true;
      return (
        (tx.description ?? '').toLowerCase().includes(needle) ||
        (tx.categoryLabel ?? '').toLowerCase().includes(needle) ||
        formatAmount(tx.amount).includes(needle)
      );
    });
  }, [transactions, query, accountId, category, kind, minN, maxN, window]);

  // Server search: debounced, only when something is filtered and the filter is one the
  // backend understands ("no category" is client-side only).
  const searchParams = useMemo<SearchParams | null>(() => {
    const any = query.trim() || accountId || (category && category !== NONE) || kind || window || Number.isFinite(minN) || Number.isFinite(maxN);
    if (!any || category === NONE) return null;
    return {
      q: query.trim() || undefined,
      accountId: accountId ?? undefined,
      categoryLabel: category ?? undefined,
      kind: kind || undefined,
      from: window ? isoDay(window.from) : undefined,
      to: window ? isoDay(window.to) : undefined,
      min: Number.isFinite(minN) ? minN : undefined,
      max: Number.isFinite(maxN) ? maxN : undefined,
      size: 500,
    };
  }, [query, accountId, category, kind, window, minN, maxN]);

  const [server, setServer] = useState<{ key: string; items: Transaction[]; sums: { income: number; expense: number; count: number }; total: number } | null>(null);
  const searchKey = searchParams ? JSON.stringify(searchParams) : '';
  useEffect(() => {
    if (!searchParams || !token) {
      setServer(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .search(token, searchParams)
        .then((page) => {
          if (!cancelled) setServer({ key: searchKey, items: page.items, sums: page.sums, total: page.total });
        })
        .catch(() => {
          if (!cancelled) setServer(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, token, transactions]);

  const rows = server && server.key === searchKey ? server.items : filtered;

  const sections = useMemo(() => {
    if (!prefs.groupByDay) {
      const flat = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return [{ key: 'all', title: '', total: 0, data: flat }];
    }
    return groupByDay(rows);
  }, [rows, prefs.groupByDay]);

  const sums = useMemo(() => {
    if (server && server.key === searchKey) return { ...server.sums, total: server.total };
    let income = 0;
    let expense = 0;
    for (const tx of rows) {
      if (isTransfer(tx.kind)) continue;
      if (signOf(tx.kind) > 0) income += tx.baseAmount ?? tx.amount;
      else expense += tx.baseAmount ?? tx.amount;
    }
    return { income, expense, count: rows.length, total: rows.length };
  }, [rows, server, searchKey]);

  const filtering = !!(query || accountId || category || kind || period || min || max);
  const filterCount = [accountId, category, Number.isFinite(minN) || Number.isFinite(maxN) ? 'amount' : null].filter(Boolean).length;

  const clearAll = () => {
    tick();
    setQuery('');
    setAccountId(null);
    setCategory(null);
    setKind('');
    setPeriod(null);
    setMin('');
    setMax('');
  };

  const toggle = (id: string) => {
    tick();
    setSelected((cur) => {
      const next = new Set(cur ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSet = async (label: string | null) => {
    setPicking(null);
    if (!selected || !label) return;
    const ids = [...selected].filter((id) => {
      const tx = rows.find((r) => r.id === id) ?? transactions.find((r) => r.id === id);
      return tx && !isTransfer(tx.kind);
    });
    if (!ids.length) {
      toast.error('Nothing to change', 'Transfers have no category.');
      return;
    }
    setBusy(true);
    try {
      await mutate(async (t) => {
        for (const id of ids) await api.updateTransaction(t, id, { categoryLabel: label });
      });
      toast.success(`${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} → ${label}`);
      setSelected(null);
    } catch (e) {
      toast.error('Could not recategorise', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const selectable = rows.filter((r) => !isTransfer(r.kind));

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + space.md }}>
        <View style={styles.head}>
          <Text style={[type.title, { color: theme.text, flex: 1 }]}>Activity</Text>
          <Btn small icon="cloud-upload-outline" label="Import" onPress={() => router.push('/import')} />
        </View>

        <View style={[styles.search, { backgroundColor: theme.keypad, borderColor: theme.hairline }]}>
          <Ionicons name="search" size={16} color={theme.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes and categories"
            placeholderTextColor={theme.textFaint}
            style={[styles.searchInput, { color: theme.text }]}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textFaint} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              tick();
              setShowFilters((v) => !v);
            }}
            hitSlop={8}
            style={styles.filterBtn}
            accessibilityLabel="Filters"
          >
            <Ionicons name="options-outline" size={17} color={filterCount ? theme.accent : theme.textMuted} />
            {filterCount ? <Text style={[type.caption, { color: theme.accent }]}>{filterCount}</Text> : null}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All time" active={period === null} onPress={() => setPeriod(null)} />
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(period === p.key ? null : p.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {KINDS.map((k) => (
            <Chip key={k.key || 'all'} label={k.label} active={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
          <Chip
            label="No category"
            icon="alert-circle-outline"
            active={category === NONE}
            onPress={() => setCategory(category === NONE ? null : NONE)}
          />
        </ScrollView>

        {showFilters ? (
          <View style={[styles.panel, { backgroundColor: theme.bgElevated, borderColor: theme.hairline }]}>
            <Text style={[type.caption, { color: theme.textFaint }]}>ACCOUNT</Text>
            <View style={styles.wrap}>
              <Chip label="All" active={!accountId} onPress={() => setAccountId(null)} />
              {accounts.map((a) => (
                <Chip key={a.id} label={a.accountName} active={accountId === a.id} onPress={() => setAccountId(accountId === a.id ? null : a.id)} />
              ))}
            </View>
            <Text style={[type.caption, { color: theme.textFaint, marginTop: space.sm }]}>CATEGORY</Text>
            <View style={styles.wrap}>
              <Chip label={category && category !== NONE ? category : 'Any category'} active={!!category && category !== NONE} onPress={() => setPicking('filter')} icon="pricetag-outline" />
              {category ? <Chip label="Clear" active={false} onPress={() => setCategory(null)} /> : null}
            </View>
            <Text style={[type.caption, { color: theme.textFaint, marginTop: space.sm }]}>AMOUNT ({prefs.currency})</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Field value={min} onChangeText={setMin} placeholder="from" keyboardType="decimal-pad" style={{ flex: 1 }} />
              <Field value={max} onChangeText={setMax} placeholder="to" keyboardType="decimal-pad" style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>

      {filtering ? (
        <View style={styles.summary}>
          <Text style={[type.caption, { color: theme.textFaint, flex: 1 }]}>
            {sums.total} {sums.total === 1 ? 'entry' : 'entries'} · in <Text style={{ color: theme.positive }}>{mask(formatAmount(sums.income), 'all')}</Text> · out{' '}
            <Text style={{ color: theme.negative }}>{mask(formatAmount(sums.expense), 'all')}</Text>
          </Text>
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={[type.label, { color: theme.accent }]}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {selected ? (
        <View style={[styles.summary, { paddingTop: space.sm }]}>
          <Text style={[type.label, { color: theme.text, flex: 1 }]}>{selected.size} selected</Text>
          <Pressable
            onPress={() => setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.id)))}
            hitSlop={8}
          >
            <Text style={[type.label, { color: theme.accent }]}>{selected.size === selectable.length ? 'None' : 'All'}</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + (selected ? 170 : 110), paddingTop: space.xs }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
        renderSectionHeader={({ section }) =>
          section.title === '' ? null : (
            <View style={styles.dayHeader}>
              <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{section.title}</Text>
              <Text style={[type.caption, { color: section.total >= 0 ? theme.positive : theme.negative }]}>
                {section.total >= 0 ? '+' : '−'}
                {mask(formatAmount(section.total), 'all')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            category={categoryByLabel.get(item.categoryLabel ?? '')}
            accountName={accountName.get(item.userAccountId ?? '')}
            showAccount={accounts.length > 1 && !accountId}
            showDate={!prefs.groupByDay}
            selected={selected ? selected.has(item.id) : undefined}
            onPress={() => (selected ? toggle(item.id) : router.push({ pathname: '/entry', params: { id: item.id } }))}
            onLongPress={isTransfer(item.kind) ? undefined : () => (selected ? toggle(item.id) : (tick(), setSelected(new Set([item.id]))))}
            onDelete={() => deleteTransaction(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.label, { color: theme.textFaint }]}>
              {filtering ? 'Nothing matches that filter.' : 'No entries yet. Tap + or import a statement.'}
            </Text>
          </View>
        }
        ListFooterComponent={
          rows.length && !selected ? (
            <Text style={[type.caption, { color: theme.textFaint, textAlign: 'center', marginTop: space.lg }]}>
              Long-press an entry to select several and recategorise them.
            </Text>
          ) : undefined
        }
      />

      {selected ? (
        <View style={[styles.bulkBar, { bottom: insets.bottom + 72, backgroundColor: theme.bgElevated, borderColor: theme.hairline }]}>
          <Btn label="Cancel" onPress={() => setSelected(null)} style={{ flex: 1 }} />
          <Btn
            primary
            icon="pricetag-outline"
            label={busy ? 'Saving…' : 'Set category'}
            disabled={!selected.size || busy}
            onPress={() => setPicking('bulk')}
            style={{ flex: 2 }}
          />
        </View>
      ) : null}

      <CategoryPicker
        visible={picking !== null}
        title={picking === 'bulk' ? `Category for ${selected?.size ?? 0}` : 'Filter by category'}
        onClose={() => setPicking(null)}
        onPick={(label) => {
          if (picking === 'bulk') void bulkSet(label);
          else {
            setCategory(label);
            setPicking(null);
          }
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, gap: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: space.xs },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.sm },
  panel: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  summary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.md, gap: space.md },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xs },
  empty: { alignItems: 'center', paddingVertical: 64 },
  bulkBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
