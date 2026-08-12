import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { useApp } from '../../src/store';
import { api, Category } from '../../src/api';
import { useTheme } from '../../src/preferences';
import { useToast } from '../../src/components/Toast';
import { useDestructiveAction } from '../../src/components/ConfirmDialog';
import { categoryColor, radius, space, type } from '../../src/theme';

export default function Categories() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories, transactions, mutate } = useApp();
  const toast = useToast();
  const confirmDestructive = useDestructiveAction();

  // How often each category is used — deleting an unused one is safe, deleting a
  // heavily-used one is worth warning about.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.categoryLabel) continue;
      counts.set(tx.categoryLabel, (counts.get(tx.categoryLabel) ?? 0) + 1);
    }
    return counts;
  }, [transactions]);

  const groups = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of [...categories].sort((a, b) => a.label.localeCompare(b.label))) {
      const key = c.parentGroup?.trim() || 'Ungrouped';
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [categories]);

  const remove = (c: Category) => {
    const used = usage.get(c.label) ?? 0;
    void confirmDestructive(
      {
        title: 'Delete this category?',
        message:
          used > 0
            ? `${c.label} is used by ${used} transaction${used === 1 ? '' : 's'}. They keep their history, but the category will no longer be offered.`
            : c.label,
      },
      () => mutate((t) => api.deleteCategory(t, c.label)),
      {
        onSuccess: () => toast.success('Category deleted', c.label),
        onError: (message) => toast.error('Could not delete', message),
      },
    );
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.title, { color: theme.text }]}>Categories</Text>
        <Pressable onPress={() => router.push('/settings/category')} hitSlop={10}>
          <Ionicons name="add" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        {groups.map(([group, items]) => (
          <View key={group}>
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
              {group}
            </Text>
            <Glass style={styles.card}>
              <View style={{ paddingVertical: space.xs }}>
                {items.map((c, i) => (
                  <View key={c.id}>
                    {i > 0 ? (
                      <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
                    ) : null}
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/settings/category', params: { label: c.label } })
                      }
                      onLongPress={() => remove(c)}
                      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.6 } : null]}
                    >
                      <View
                        style={[
                          styles.icon,
                          { backgroundColor: theme.keypad },
                        ]}
                      >
                        <Ionicons
                          name={(c.icon ?? 'pricetag') as never}
                          size={16}
                          color={categoryColor(theme, c.label, c.color)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                          {c.label}
                        </Text>
                        <Text style={[type.caption, { color: theme.textFaint, marginTop: 2 }]}>
                          {c.categoryType === 'INCOME' ? 'Income' : 'Expense'} ·{' '}
                          {usage.get(c.label) ?? 0} used
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </Glass>
          </View>
        ))}

        <Text
          style={[
            type.caption,
            { color: theme.textFaint, paddingHorizontal: space.xl, marginTop: space.lg },
          ]}
        >
          Tap to edit, long-press to delete.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  card: { marginHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  icon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
