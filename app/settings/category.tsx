import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../../src/components/TextInput';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { useApp } from '../../src/store';
import { CategoryType } from '../../src/core';
import { api } from '../../src/api';
import { useTheme } from '../../src/preferences';
import { useToast } from '../../src/components/Toast';
import { radius, space, type } from '../../src/theme';

/** A small, deliberately finite icon set — enough to be expressive, few enough to scan. */
const ICONS = [
  'fast-food', 'restaurant', 'cafe', 'cart', 'basket', 'shirt', 'home', 'bed',
  'car', 'bus', 'airplane', 'bicycle', 'medkit', 'fitness', 'school', 'book',
  'film', 'game-controller', 'musical-notes', 'gift', 'paw', 'construct',
  'briefcase', 'card', 'cash', 'trending-up', 'phone-portrait', 'wifi',
  'flash', 'water', 'flower', 'pricetag',
];

export default function CategoryEditor() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { label: editingLabel } = useLocalSearchParams<{ label?: string }>();
  const { categories, mutate } = useApp();
  const toast = useToast();

  const existing = useMemo(
    () => categories.find((c) => c.label === editingLabel),
    [categories, editingLabel],
  );

  const [label, setLabel] = useState(existing?.label ?? '');
  const [group, setGroup] = useState(existing?.parentGroup ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'pricetag');
  const [color, setColor] = useState(existing?.color ?? theme.categorical[0]);
  const [categoryType, setCategoryType] = useState<CategoryType>(
    existing?.categoryType ?? 'EXPENSE',
  );
  const [busy, setBusy] = useState(false);

  // Offer the groups already in use, so related categories cluster instead of
  // accumulating near-duplicate group names.
  const knownGroups = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) if (c.parentGroup?.trim()) set.add(c.parentGroup.trim());
    return [...set].sort();
  }, [categories]);

  const canSave = label.trim().length > 0 && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload = {
        parentGroup: group.trim() || null,
        color,
        icon,
        categoryType,
      };
      if (existing) {
        await mutate((t) =>
          api.updateCategory(t, {
            label: existing.label,
            newLabel: label.trim() !== existing.label ? label.trim() : undefined,
            ...payload,
          }),
        );
      } else {
        await mutate((t) => api.createCategory(t, { label: label.trim(), ...payload }));
      }
      router.back();
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.label, { color: theme.textMuted }]}>
          {existing ? 'Edit category' : 'New category'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: space.xxl }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* Live preview, so the icon and colour choices are legible before saving. */}
          <View style={styles.preview}>
            <View style={[styles.previewIcon, { backgroundColor: theme.keypad }]}>
              <Ionicons name={icon as never} size={26} color={color} />
            </View>
            <Text style={[type.title, { color: theme.text }]} numberOfLines={1}>
              {label.trim() || 'Untitled'}
            </Text>
            <Text style={[type.caption, { color: theme.textFaint }]}>
              {categoryType === 'INCOME' ? 'Income' : 'Expense'}
              {group.trim() ? ` · ${group.trim()}` : ''}
            </Text>
          </View>

          <Field label="Name">
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Groceries"
              placeholderTextColor={theme.textFaint}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
              ]}
            />
          </Field>

          <Field label="Type">
            <View style={[styles.segment, { backgroundColor: theme.keypad }]}>
              {(['EXPENSE', 'INCOME'] as CategoryType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setCategoryType(t)}
                  style={[
                    styles.segmentItem,
                    categoryType === t ? { backgroundColor: theme.bgElevated } : null,
                  ]}
                >
                  <Text
                    style={[
                      type.label,
                      { color: categoryType === t ? theme.text : theme.textFaint },
                    ]}
                  >
                    {t === 'EXPENSE' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Group">
            <TextInput
              value={group}
              onChangeText={setGroup}
              placeholder="Optional, e.g. Food & Snacks"
              placeholderTextColor={theme.textFaint}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
              ]}
            />
            {knownGroups.length ? (
              <View style={[styles.wrap, { marginTop: space.sm }]}>
                {knownGroups.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGroup(g)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: group === g ? theme.text : theme.keypad,
                        borderColor: group === g ? theme.text : theme.hairline,
                      },
                    ]}
                  >
                    <Text
                      style={[type.label, { color: group === g ? theme.bg : theme.textMuted }]}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Field>

          <Field label="Colour">
            <View style={styles.wrap}>
              {theme.categorical.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  accessibilityLabel={`Colour ${c}`}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: c,
                      borderColor: color === c ? theme.text : 'transparent',
                    },
                  ]}
                >
                  {color === c ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Icon">
            <View style={styles.wrap}>
              {ICONS.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setIcon(name)}
                  accessibilityLabel={name}
                  style={[
                    styles.iconChoice,
                    {
                      backgroundColor: icon === name ? theme.text : theme.keypad,
                      borderColor: icon === name ? theme.text : theme.hairline,
                    },
                  ]}
                >
                  <Ionicons
                    name={name as never}
                    size={18}
                    color={icon === name ? theme.bg : theme.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          onPress={save}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: theme.text, opacity: !canSave ? 0.3 : pressed ? 0.8 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={[type.label, { color: theme.bg, fontSize: 15 }]}>
              {existing ? 'Save changes' : 'Create category'}
            </Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text
        style={[
          type.caption,
          { color: theme.textFaint, textTransform: 'uppercase', marginBottom: space.sm },
        ]}
      >
        {label}
      </Text>
      {children}
    </View>
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
  preview: { alignItems: 'center', gap: space.sm, paddingVertical: space.lg },
  previewIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { paddingHorizontal: space.lg, marginBottom: space.lg },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoice: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  footer: { paddingHorizontal: space.lg },
  save: { borderRadius: radius.md, paddingVertical: space.md + 4, alignItems: 'center' },
});
