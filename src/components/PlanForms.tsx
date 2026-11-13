import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from './TextInput';
import { Glass } from './Glass';
import { useToast } from './Toast';
import { useApp } from '../store';
import { Goal, formatAmount } from '../core';
import { api } from '../api';
import { usePreferences, useTheme } from '../preferences';
import { radius, space, type } from '../theme';
import { Pills, Segment } from './ui';

/** Creating plans and goals and putting money towards a goal; shared by Plan and the pot detail. */

export function PlannedForm({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { prefs } = usePreferences();
  const { accounts, categories, mutate } = useApp();
  const toast = useToast();
  const [kind, setKind] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(String(new Date().getDate()));
  const [category, setCategory] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(prefs.defaultAccountId ?? accounts[0]?.id ?? null);
  const [toId, setToId] = useState<string | null>(accounts[1]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const value = Number.parseFloat(amount.replace(',', '.'));
  const valid = name.trim() && value > 0 && accountId && (kind === 'TRANSFER' ? toId && toId !== accountId : category);

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const d = Math.min(28, Math.max(1, Number.parseInt(day) || 1));
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), d);
      const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      await mutate((t) =>
        api.createPlanned(t, {
          name: name.trim(), amount: value, startDate: iso, frequency: 'MONTHLY', accountId: accountId!,
          categoryLabel: kind === 'TRANSFER' ? null : category, toAccountId: kind === 'TRANSFER' ? toId : null,
        }),
      );
      toast.success('Planned', `${name.trim()} · monthly on the ${d}.`);
      onDone();
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };
  const field = { color: theme.text, backgroundColor: theme.bgElevated, borderColor: theme.hairline };
  return (
    <Glass style={[styles.card, { marginBottom: space.md }]}>
      <View style={[styles.cardInner, { gap: space.md }]}>
        <Segment options={[['EXPENSE', 'Expense'], ['INCOME', 'Income'], ['TRANSFER', 'Transfer']]} value={kind} onChange={(k) => setKind(k as typeof kind)} />
        <TextInput value={name} onChangeText={setName} placeholder={kind === 'INCOME' ? 'Lohn' : kind === 'TRANSFER' ? 'Sparen' : 'Miete'} placeholderTextColor={theme.textFaint} style={[styles.input, field]} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput value={amount} onChangeText={setAmount} placeholder={`Amount · ${prefs.currency}`} placeholderTextColor={theme.textFaint} keyboardType="decimal-pad" style={[styles.input, field, { flex: 1 }]} />
          <TextInput value={day} onChangeText={setDay} placeholder="Day" placeholderTextColor={theme.textFaint} keyboardType="number-pad" style={[styles.input, field, { width: 80 }]} />
        </View>
        <Text style={[type.caption, { color: theme.textFaint }]}>MONTHLY, ON DAY {day || '?'} · MORE OPTIONS ON THE WEB</Text>
        <Pills items={accounts.map((a) => ({ key: a.id, label: kind === 'TRANSFER' ? `from ${a.accountName}` : a.accountName }))} selected={accountId} onSelect={setAccountId} />
        {kind === 'TRANSFER' ? (
          <Pills items={accounts.filter((a) => a.id !== accountId).map((a) => ({ key: a.id, label: `to ${a.accountName}` }))} selected={toId} onSelect={setToId} />
        ) : (
          <Pills items={categories.filter((c) => c.categoryType === (kind === 'INCOME' ? 'INCOME' : 'EXPENSE')).sort((a, b) => a.label.localeCompare(b.label)).map((c) => ({ key: c.label, label: c.label }))} selected={category} onSelect={setCategory} />
        )}
        <Pressable onPress={save} disabled={!valid || busy} style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text, opacity: valid && !busy ? 1 : 0.4 }]}>
          <Text style={[type.label, { color: theme.bgElevated }]}>{busy ? 'Saving…' : 'Save plan'}</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

export function GoalForm({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const { prefs } = usePreferences();
  const { accounts, mutate } = useApp();
  const toast = useToast();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number.parseFloat(target.replace(',', '.'));
  const valid = name.trim() && value > 0;
  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await mutate((t) => api.createGoal(t, { name: name.trim(), targetAmount: value, accountId }));
      toast.success('Goal set', name.trim());
      onDone();
    } catch (e) {
      toast.error('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };
  const field = { color: theme.text, backgroundColor: theme.bgElevated, borderColor: theme.hairline };
  return (
    <Glass style={[styles.card, { marginBottom: space.md }]}>
      <View style={[styles.cardInner, { gap: space.md }]}>
        <TextInput value={name} onChangeText={setName} placeholder="Notgroschen" placeholderTextColor={theme.textFaint} style={[styles.input, field]} />
        <TextInput value={target} onChangeText={setTarget} placeholder={`Target · ${prefs.currency}`} placeholderTextColor={theme.textFaint} keyboardType="decimal-pad" style={[styles.input, field]} />
        <Text style={[type.caption, { color: theme.textFaint }]}>TRACKS AN ACCOUNT (OPTIONAL)</Text>
        <Pills items={[{ key: '', label: 'My own count' }, ...accounts.map((a) => ({ key: a.id, label: a.accountName }))]} selected={accountId ?? ''} onSelect={(k) => setAccountId(k || null)} />
        <Pressable onPress={save} disabled={!valid || busy} style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text, opacity: valid && !busy ? 1 : 0.4 }]}>
          <Text style={[type.label, { color: theme.bgElevated }]}>{busy ? 'Saving…' : 'Save goal'}</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

export function Contribute({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  const theme = useTheme();
  const { prefs } = usePreferences();
  const { accounts, mutate } = useApp();
  const toast = useToast();
  const [amount, setAmount] = useState(goal.requiredPerMonth ? goal.requiredPerMonth.toFixed(2) : '');
  const [from, setFrom] = useState<string | null>(accounts.find((a) => a.id !== goal.accountId)?.id ?? null);
  const [busy, setBusy] = useState(false);
  const value = Number.parseFloat(amount.replace(',', '.'));
  const valid = value > 0 && (!goal.accountId || from);
  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await mutate((t) => api.contributeGoal(t, goal.id, value, goal.accountId ? from : null));
      toast.success(`Added ${prefs.currency} ${formatAmount(value)}`, goal.name);
      onDone();
    } catch (e) {
      toast.error('Could not add', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <TextInput value={amount} onChangeText={setAmount} placeholder={`Amount · ${prefs.currency}`} placeholderTextColor={theme.textFaint} keyboardType="decimal-pad" style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.hairline }]} />
      {goal.accountId ? <Pills items={accounts.filter((a) => a.id !== goal.accountId).map((a) => ({ key: a.id, label: `from ${a.accountName}` }))} selected={from} onSelect={setFrom} /> : null}
      <Pressable onPress={save} disabled={!valid || busy} style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text, opacity: valid && !busy ? 1 : 0.4 }]}>
        <Text style={[type.label, { color: theme.bgElevated }]}>{busy ? 'Adding…' : goal.accountId ? 'Transfer' : 'Add'}</Text>
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg },
  cardInner: { padding: space.lg },
  action: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 },
});
