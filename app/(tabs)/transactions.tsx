import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { TransactionRow } from '../../src/components/TransactionRow';
import { useApp } from '../../src/store';
import { formatAmount, groupByDay } from '../../src/format';
import { radius, space, type } from '../../src/theme';
import { usePreferences, useTheme } from '../../src/preferences';

export default function Transactions() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accounts, categories, transactions, refreshing, refresh } = useApp();
  const { prefs } = usePreferences();

  // Arriving from a category bar in Insights pre-fills the search.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? '');

  useEffect(() => {
    if (q) setQuery(q);
  }, [q]);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);

  const categoryByLabel = useMemo(
    () => new Map(categories.map((c) => [c.label, c])),
    [categories],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.accountName])),
    [accounts],
  );

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = transactions.filter((tx) => {
      if (accountFilter && tx.userAccountId !== accountFilter) return false;
      if (!needle) return true;
      return (
        (tx.description ?? '').toLowerCase().includes(needle) ||
        (tx.categoryLabel ?? '').toLowerCase().includes(needle) ||
        formatAmount(tx.amount).includes(needle)
      );
    });
    if (!prefs.groupByDay) {
      // One unlabelled section keeps the SectionList shape without the day headers.
      const flat = [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      return [{ key: 'all', title: '', total: 0, data: flat }];
    }
    return groupByDay(filtered);
  }, [transactions, query, accountFilter, prefs.groupByDay]);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + space.md }}>
        <Text style={[type.title, { color: theme.text, paddingHorizontal: space.xl }]}>
          Transactions
        </Text>

        <View
          style={[
            styles.search,
            { backgroundColor: theme.keypad, borderColor: theme.hairline },
          ]}
        >
          <Ionicons name="search" size={16} color={theme.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes, categories, amounts"
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
        </View>

        {accounts.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip
              label="All"
              active={accountFilter === null}
              onPress={() => setAccountFilter(null)}
            />
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.accountName}
                active={accountFilter === a.id}
                onPress={() => setAccountFilter(accountFilter === a.id ? null : a.id)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96, paddingTop: space.sm }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.textMuted}
          />
        }
        renderSectionHeader={({ section }) =>
          section.title === '' ? null : (
          <View style={styles.dayHeader}>
            <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>
              {section.title}
            </Text>
            <Text style={[type.caption, { color: theme.textFaint }]}>
              {section.total >= 0 ? '+' : '−'}
              {formatAmount(section.total)}
            </Text>
          </View>
          )
        }
        renderItem={({ item }) => (
          <TransactionRow
            tx={item}
            category={categoryByLabel.get(item.categoryLabel ?? '')}
            accountName={accountById.get(item.userAccountId ?? '')}
            showAccount={accounts.length > 1 && accountFilter === null}
            onPress={() => router.push({ pathname: '/entry', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.label, { color: theme.textFaint }]}>
              {query || accountFilter ? 'Nothing matches that filter.' : 'No transactions yet.'}
            </Text>
          </View>
        }
      />
    </Screen>
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

const styles = StyleSheet.create({
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
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  empty: { alignItems: 'center', paddingVertical: 64 },
});
