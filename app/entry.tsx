import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../src/components/TextInput';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Screen } from '../src/components/Screen';
import { Keypad, applyKey } from '../src/components/Keypad';
import { SuccessBurst } from '../src/components/SuccessBurst';
import { useToast } from '../src/components/Toast';
import { useDestructiveAction } from '../src/components/ConfirmDialog';
import { useApp } from '../src/store';
import { Category, formatAmount, formatDayHeading, isTransfer } from '../src/core';
import { api } from '../src/api';
import { categoryColor, radius, space, type } from '../src/theme';
import { usePreferences, useTheme } from '../src/preferences';

type Mode = 'EXPENSE' | 'INCOME' | 'TRANSFER';

export default function Entry() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, mode: modeParam } = useLocalSearchParams<{ id?: string; mode?: string }>();
  const { accounts, categories, transactions, mutate, token } = useApp();
  const { prefs } = usePreferences();
  const toast = useToast();
  const confirmDestructive = useDestructiveAction();

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
    if (!editing) return modeParam === 'TRANSFER' || modeParam === 'INCOME' ? modeParam : 'EXPENSE';
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
    editing?.userAccountId ?? prefs.defaultAccountId ?? accounts[0]?.id ?? null,
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
  const [noteFocused, setNoteFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  // Set once the write has landed; the burst owns the screen until it dismisses itself.
  const [saved, setSaved] = useState<{ title: string; subtitle: string } | null>(null);

  const numericAmount = Number.parseFloat(amount || '0');

  // Quick entry: a sentence like "12.50 kebab cash yesterday" fills the form in one go.
  // Parsed on the server (debounced) so the phone and the web agree on the reading.
  const [quick, setQuick] = useState('');
  const [quickHint, setQuickHint] = useState<string | null>(null);
  const quickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (editing || !token || !quick.trim()) {
      setQuickHint(null);
      return;
    }
    if (quickTimer.current) clearTimeout(quickTimer.current);
    quickTimer.current = setTimeout(async () => {
      try {
        const r = await api.quick(token, quick, false);
        const p = r.parsed;
        if (p.kind === 'TRANSFER_OUT') {
          setMode('TRANSFER');
          if (p.accountId) setFromId(p.accountId);
          if (p.toAccountId) setToId(p.toAccountId);
        } else {
          setMode(p.kind === 'INCOME' ? 'INCOME' : 'EXPENSE');
          if (p.categoryLabel) setCategoryLabel(p.categoryLabel);
          if (p.accountId) setAccountId(p.accountId);
        }
        if (p.amount !== null) setAmount(p.amount.toFixed(2).replace(/\.00$/, ''));
        if (p.description && p.description !== p.categoryLabel) setNote(p.description);
        setDate(new Date(`${p.date}T12:00:00`));
        setQuickHint(r.ready ? 'Ready — tap the tick to book' : `Missing: ${r.missing.join(', ')}`);
      } catch {
        setQuickHint(null);
      }
    }, 320);
    return () => {
      if (quickTimer.current) clearTimeout(quickTimer.current);
    };
  }, [quick, token, editing]);

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

      if (prefs.haptics && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setSaved({
        title: editing ? 'Saved' : mode === 'INCOME' ? 'Income logged' : 'Logged',
        subtitle: `${mode === 'EXPENSE' ? '−' : mode === 'INCOME' ? '+' : ''}${prefs.currency} ${formatAmount(numericAmount)}${
          mode === 'TRANSFER' ? '' : categoryLabel ? ` · ${categoryLabel}` : ''
        }`,
      });
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // Leaves the sheet once the success mark has played, and repeats it as a toast so the
  // confirmation is still there on the screen you land back on.
  const finishSave = () => {
    const done = saved;
    setSaved(null);
    router.back();
    if (done) toast.success(done.title, done.subtitle);
  };

  const remove = () => {
    if (!editing) return;
    void confirmDestructive(
      {
        title: 'Delete this transaction?',
        message: editing.transferGroupId
          ? 'Both sides of this transfer will be removed.'
          : 'This cannot be undone.',
        confirmLabel: 'Delete',
      },
      () =>
        editing.transferGroupId
          ? mutate((t) => api.deleteTransfer(t, editing.transferGroupId!))
          : mutate((t) => api.deleteTransaction(t, editing.id)),
      {
        onSuccess: () => {
          router.back();
          toast.success('Transaction deleted');
        },
        onError: (message) => toast.error('Could not delete', message),
      },
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

      {/* Quick entry, only for new entries: typing beats tapping when you know what it was. */}
      {!editing ? (
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.sm }}>
          <View
            style={[
              styles.noteRow,
              { marginHorizontal: 0, marginBottom: 0, backgroundColor: theme.bgElevated, borderColor: quick ? theme.hairlineStrong : theme.hairline },
            ]}
          >
            <Ionicons name="flash-outline" size={18} color={theme.accent} />
            <TextInput
              value={quick}
              onChangeText={setQuick}
              placeholder="Type it: 12.50 kebab cash yesterday"
              placeholderTextColor={theme.textFaint}
              returnKeyType="done"
              autoCorrect={false}
              style={[styles.note, { color: theme.text }]}
            />
            {quick ? (
              <Pressable onPress={() => setQuick('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={theme.textFaint} />
              </Pressable>
            ) : null}
          </View>
          {quickHint ? (
            <Text style={[type.caption, { color: quickHint.startsWith('Ready') ? theme.positive : theme.textFaint, marginTop: 6, marginLeft: 4 }]}>
              {quickHint}
            </Text>
          ) : null}
        </View>
      ) : null}

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
      <View
        style={[styles.amountRow, noteFocused ? { paddingVertical: space.md } : null]}
      >
        <Text style={[type.body, { color: theme.textFaint, marginBottom: 10 }]}>
          {prefs.currency}
        </Text>
        <Text
          style={[type.display, { color: amountColor, fontSize: noteFocused ? 36 : 52 }]}
          numberOfLines={1}
        >
          {mode === 'EXPENSE' ? '−' : mode === 'INCOME' ? '+' : ''}
          {amount}
        </Text>
      </View>

      {/* Note. Pinned here rather than at the foot of the scroller: it is the one field
          that needs the text keyboard, and down there the keyboard covered it. */}
      <View
        style={[
          styles.noteRow,
          {
            backgroundColor: theme.keypad,
            borderColor: noteFocused ? theme.text : theme.hairline,
          },
        ]}
      >
        <Ionicons name="create-outline" size={18} color={theme.textFaint} />
        <TextInput
          value={note}
          onChangeText={setNote}
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setNoteFocused(false)}
          placeholder="What was it for?"
          placeholderTextColor={theme.textFaint}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          style={[styles.note, { color: theme.text }]}
        />
        {note ? (
          <Pressable onPress={() => setNote('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={theme.textFaint} />
          </Pressable>
        ) : null}
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
                              : categoryColor(theme, c.label, c.color)
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {noteFocused ? null : <Keypad onKey={(k) => setAmount((a) => applyKey(a, k))} />}
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

      {saved ? (
        <SuccessBurst
          title={saved.title}
          subtitle={saved.subtitle}
          tone={mode === 'EXPENSE' ? 'neutral' : 'positive'}
          onDone={finishSave}
        />
      ) : null}
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
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  note: {
    flex: 1,
    paddingVertical: space.md + 2,
    fontSize: 17,
  },
  footer: { paddingHorizontal: space.lg, gap: space.md },
  save: {
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    alignItems: 'center',
  },
});
