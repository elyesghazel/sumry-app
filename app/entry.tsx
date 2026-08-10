import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen } from '../src/components/Screen';
import { Keypad, applyKey } from '../src/components/Keypad';
import { useApp } from '../src/store';
import { api, Category } from '../src/api';
import { CURRENCY, formatDayHeading, isTransfer } from '../src/format';
import { radius, space, type, useTheme } from '../src/theme';

type Mode = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export default function Entry() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { accounts, categories, transactions, mutate } = useApp();

  const editing = useMemo(
    () => (id ? transactions.find((t) => t.id === id) : undefined),
    [id, transactions],
  );

  // Both legs of a transfer, so an edit can show the real source and destination.
  const transferLegs = useMemo(() => {
    if (!editing?.transferGroupId) return null;
    const legs = transactions.filter((t) => t.transferGroupId === editing.transferGroupId);
    return {
      out: legs.find((l) => l.kind === 'TRANSFER_OUT'),
      in: legs.find((l) => l.kind === 'TRANSFER_IN'),
    };
  }, [editing, transactions]);

  const [mode, setMode] = useState<Mode>(() => {
    if (!editing) return 'EXPENSE';
    if (isTransfer(editing.kind)) return 'TRANSFER';
    return editing.kind === 'INCOME' ? 'INCOME' : 'EXPENSE';
  });

  const [amount, setAmount] = useState(() =>
    editing ? String(editing.amount.toFixed(2)) : '0',
  );
  const [categoryLabel, setCategoryLabel] = useState<string | null>(
    editing?.categoryLabel ?? null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    editing?.userAccountId ?? accounts[0]?.id ?? null,
  );
  const [fromId, setFromId] = useState<string | null>(
    transferLegs?.out?.userAccountId ?? accounts[0]?.id ?? null,
  );
  const [toId, setToId] = useState<string | null>(
    transferLegs?.in?.userAccountId ?? accounts[1]?.id ?? null,
  );
  const [note, setNote] = useState(editing?.description ?? '');
  const [date, setDate] = useState(() => (editing ? new Date(editing.date) : new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const numericAmount = Number.parseFloat(amount || '0');

  const visibleCategories = useMemo(
    () =>
      categories
        .filter((c) => c.categoryType === (mode === 'INCOME' ? 'INCOME' : 'EXPENSE'))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categories, mode],
  );

  // Group the picker by the parent group carried over from Bluecoins.
  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of visibleCategories) {
      const key = c.parentGroup ?? 'Other';
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleCategories]);

  const canSave =
    numericAmount > 0 &&
    !busy &&
    (mode === 'TRANSFER'
      ? Boolean(fromId && toId && fromId !== toId)
      : Boolean(categoryLabel && accountId));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const iso = date.toISOString();

      if (mode === 'TRANSFER') {
        const payload = {
          amount: numericAmount,
          description: note.trim() || null,
          fromAccountId: fromId!,
          toAccountId: toId!,
          date: iso,
        };
        if (editing?.transferGroupId) {
          await mutate((t) => api.updateTransfer(t, editing.transferGroupId!, payload));
        } else {
          await mutate((t) => api.createTransfer(t, payload));
        }
      } else if (editing) {
        // A transaction that used to be a transfer cannot become an ordinary one in place.
        if (editing.transferGroupId) {
          await mutate((t) => api.deleteTransfer(t, editing.transferGroupId!));
          await mutate((t) =>
            api.createTransaction(t, {
              amount: numericAmount,
              description: note.trim() || null,
              categoryLabel: categoryLabel!,
              date: iso,
              userAccountId: accountId!,
            }),
          );
        } else {
          await mutate((t) =>
            api.updateTransaction(t, editing.id, {
              amount: numericAmount,
              description: note.trim() || null,
              categoryLabel: categoryLabel!,
              date: iso,
              userAccountId: accountId!,
            }),
          );
        }
      } else {
        await mutate((t) =>
          api.createTransaction(t, {
            amount: numericAmount,
            description: note.trim() || null,
            categoryLabel: categoryLabel!,
            date: iso,
            userAccountId: accountId!,
          }),
        );
      }
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert(
      'Delete transaction?',
      editing.transferGroupId ? 'Both sides of this transfer will be removed.' : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (editing.transferGroupId) {
                await mutate((t) => api.deleteTransfer(t, editing.transferGroupId!));
              } else {
                await mutate((t) => api.deleteTransaction(t, editing.id));
              }
              router.back();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Unknown error');
            }
          },
        },
      ],
    );
  };

  const amountColor =
    mode === 'INCOME' ? theme.positive : mode === 'TRANSFER' ? theme.text : theme.text;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.label, { color: theme.textMuted }]}>
          {editing ? 'Edit' : 'New'}
        </Text>
        {editing ? (
          <Pressable onPress={remove} hitSlop={10}>
            <Ionicons name="trash-outline" size={20} color={theme.negative} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {/* Type switch */}
      <View style={[styles.segment, { backgroundColor: theme.keypad }]}>
        {(['EXPENSE', 'INCOME', 'TRANSFER'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              if (m !== 'TRANSFER') setCategoryLabel(null);
            }}
            style={[
              styles.segmentItem,
              mode === m ? { backgroundColor: theme.bgElevated } : null,
            ]}
          >
            <Text
              style={[
                type.label,
                { color: mode === m ? theme.text : theme.textFaint },
              ]}
            >
              {m === 'EXPENSE' ? 'Expense' : m === 'INCOME' ? 'Income' : 'Transfer'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Amount */}
      <View style={styles.amountRow}>
        <Text style={[type.body, { color: theme.textFaint, marginBottom: 10 }]}>
          {CURRENCY}
        </Text>
        <Text style={[type.display, { color: amountColor, fontSize: 52 }]} numberOfLines={1}>
          {mode === 'EXPENSE' ? '−' : mode === 'INCOME' ? '+' : ''}
          {amount}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'TRANSFER' ? (
          <View style={styles.block}>
            <Label text="From" />
            <PillRow
              items={accounts.map((a) => ({ key: a.id, label: a.accountName }))}
              selected={fromId}
              onSelect={setFromId}
            />
            <View style={{ height: space.md }} />
            <Label text="To" />
            <PillRow
              items={accounts
                .filter((a) => a.id !== fromId)
                .map((a) => ({ key: a.id, label: a.accountName }))}
              selected={toId}
              onSelect={setToId}
            />
          </View>
        ) : (
          <>
            <View style={styles.block}>
              <Label text="Category" />
              {grouped.map(([group, items]) => (
                <View key={group} style={{ marginBottom: space.sm }}>
                  <Text style={[type.caption, { color: theme.textFaint, marginBottom: 6 }]}>
                    {group}
                  </Text>
                  <View style={styles.wrap}>
                    {items.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => setCategoryLabel(c.label)}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor:
                              categoryLabel === c.label ? theme.text : theme.keypad,
                            borderColor:
                              categoryLabel === c.label ? theme.text : theme.hairline,
                          },
                        ]}
                      >
                        <Ionicons
                          name={(c.icon ?? 'pricetag') as never}
                          size={14}
                          color={
                            categoryLabel === c.label
                              ? theme.bg
                              : (c.color ?? theme.textMuted)
                          }
                        />
                        <Text
                          style={[
                            type.label,
                            { color: categoryLabel === c.label ? theme.bg : theme.textMuted },
                          ]}
                        >
                          {c.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.block}>
              <Label text="Account" />
              <PillRow
                items={accounts.map((a) => ({ key: a.id, label: a.accountName }))}
                selected={accountId}
                onSelect={setAccountId}
              />
            </View>
          </>
        )}

        <View style={styles.block}>
          <Label text="When" />
          <View style={styles.wrap}>
            <QuickDate label="Today" onPress={() => setDate(new Date())} />
            <QuickDate
              label="Yesterday"
              onPress={() => setDate(new Date(Date.now() - 86_400_000))}
            />
            <Pressable
              onPress={() => setShowPicker(true)}
              style={[styles.pill, { backgroundColor: theme.keypad, borderColor: theme.hairline }]}
            >
              <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
              <Text style={[type.label, { color: theme.textMuted }]}>
                {formatDayHeading(date)}
              </Text>
            </Pressable>
          </View>
          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowPicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
            />
          ) : null}
        </View>

        <View style={styles.block}>
          <Label text="Note" />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={theme.textFaint}
            style={[
              styles.note,
              { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
            ]}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Keypad onKey={(k) => setAmount((a) => applyKey(a, k))} />
        <Pressable
          onPress={save}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: theme.text,
              opacity: !canSave ? 0.3 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.bg} />
          ) : (
            <Text style={[type.label, { color: theme.bg, fontSize: 15 }]}>
              {editing ? 'Save changes' : 'Add'}
            </Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        type.caption,
        { color: theme.textFaint, textTransform: 'uppercase', marginBottom: space.sm },
      ]}
    >
      {text}
    </Text>
  );
}

function PillRow({
  items,
  selected,
  onSelect,
}: {
  items: { key: string; label: string }[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => onSelect(item.key)}
          style={[
            styles.pill,
            {
              backgroundColor: selected === item.key ? theme.text : theme.keypad,
              borderColor: selected === item.key ? theme.text : theme.hairline,
            },
          ]}
        >
          <Text style={[type.label, { color: selected === item.key ? theme.bg : theme.textMuted }]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function QuickDate({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, { backgroundColor: theme.keypad, borderColor: theme.hairline }]}
    >
      <Text style={[type.label, { color: theme.textMuted }]}>{label}</Text>
    </Pressable>
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
  segment: {
    flexDirection: 'row',
    marginHorizontal: space.lg,
    borderRadius: radius.md,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
  },
  block: { paddingHorizontal: space.lg, marginBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
  },
  footer: { paddingHorizontal: space.lg, gap: space.md },
  save: {
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    alignItems: 'center',
  },
});
