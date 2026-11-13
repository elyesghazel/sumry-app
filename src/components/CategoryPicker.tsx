import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Category, CategoryType } from '../core';
import { useApp } from '../store';
import { useTheme } from '../preferences';
import { categoryColor, radius, space, type } from '../theme';
import { Field } from './ui';

/**
 * Bottom sheet that picks one category. Used for bulk recategorising and for the rows of
 * an import preview. `kind` narrows the list to income or expense categories.
 */
export function CategoryPicker({
  visible,
  kind,
  title = 'Choose a category',
  allowNone,
  onPick,
  onClose,
}: {
  visible: boolean;
  kind?: CategoryType | null;
  title?: string;
  /** Offers "No category" at the top. */
  allowNone?: boolean;
  onPick: (label: string | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { categories } = useApp();
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories
      .filter((c: Category) => !kind || c.categoryType === kind)
      .filter((c) => !needle || c.label.toLowerCase().includes(needle) || (c.parentGroup ?? '').toLowerCase().includes(needle))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories, kind, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.bg, borderColor: theme.hairline, paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.head}>
          <Text style={[type.title, { color: theme.text, fontSize: 20, flex: 1 }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.textMuted} />
          </Pressable>
        </View>
        <Field value={query} onChangeText={setQuery} placeholder="Search categories" autoCapitalize="none" style={{ marginHorizontal: space.lg }} />
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: space.sm }} keyboardShouldPersistTaps="handled">
          {allowNone ? (
            <Pressable onPress={() => onPick(null)} style={styles.row}>
              <Ionicons name="remove-circle-outline" size={17} color={theme.textFaint} />
              <Text style={[type.body, { color: theme.textMuted }]}>No category</Text>
            </Pressable>
          ) : null}
          {list.map((c) => (
            <Pressable key={c.id} onPress={() => onPick(c.label)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={[styles.icon, { backgroundColor: theme.keypad }]}>
                <Ionicons name={(c.icon ?? 'pricetag') as never} size={15} color={categoryColor(theme, c.label, c.color)} />
              </View>
              <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                {c.label}
              </Text>
              {c.parentGroup ? <Text style={[type.caption, { color: theme.textFaint }]}>{c.parentGroup}</Text> : null}
            </Pressable>
          ))}
          {list.length === 0 ? <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>No category matches.</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: 10 },
  icon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
