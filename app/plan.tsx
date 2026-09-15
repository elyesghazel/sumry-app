import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Glass } from '../src/components/Glass';
import { useToast } from '../src/components/Toast';
import { useDestructiveAction } from '../src/components/ConfirmDialog';
import { useApp } from '../src/store';
import { api, Goal, Planned, Subscription } from '../src/api';
import { usePreferences, useTheme } from '../src/preferences';
import { formatAmount, relativeDays } from '../src/format';
import { categoryColor, radius, space, type } from '../src/theme';

/**
 * What is going to happen to the money: planned items you can book with a tap, savings
 * goals, and the subscriptions the history reveals. Creating richer plans (end dates,
 * transfers) is the web's job; here the common cases are one screen deep.
 */
export default function Plan() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, tick, mask } = usePreferences();
  const { planned, upcoming, goals, subscriptions, accounts, categories, refreshing, refresh, mutate } = useApp();
  const toast = useToast();
  const confirmDestructive = useDestructiveAction();
  const [adding, setAdding] = useState<null | 'planned' | 'goal'>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);

  const monthlyOut = planned.filter((p) => p.isActive && p.kind === 'EXPENSE').reduce((s, p) => s + p.monthlyEquivalent, 0);
  const monthlyIn = planned.filter((p) => p.isActive && p.kind === 'INCOME').reduce((s, p) => s + p.monthlyEquivalent, 0);
  const monthlySave = planned.filter((p) => p.isActive && p.kind === 'TRANSFER_OUT').reduce((s, p) => s + p.monthlyEquivalent, 0);

  const book = async (p: Planned) => {
    tick();
    try {
      await mutate((t) => api.bookPlanned(t, p.id));
      toast.success('Booked', `${p.name} · ${prefs.currency} ${formatAmount(p.amount)}`);
    } catch (e) {
      toast.error('Could not book', e instanceof Error ? e.message : 'Unknown error');
    }
  };
  const toggleAuto = async (p: Planned) => {
    tick();
    try {
      await mutate((t) => api.updatePlanned(t, p.id, { autoBook: !p.autoBook }));
    } catch (e) {
      toast.error('Could not change', e instanceof Error ? e.message : 'Unknown error');
    }
  };
  const removePlanned = (p: Planned) =>
    void confirmDestructive(
      { title: `Delete “${p.name}”?`, message: 'Entries already booked stay.', confirmLabel: 'Delete' },
      () => mutate((t) => api.deletePlanned(t, p.id)),
      { onSuccess: () => toast.success('Deleted', p.name), onError: (m) => toast.error('Could not delete', m) },
    );
  const planSubscription = async (s: Subscription) => {
    const account = s.accountId ?? accounts[0]?.id;
    const category = s.categoryLabel ?? categories.find((c) => c.categoryType === 'EXPENSE')?.label;
    if (!account || !category) return;
    tick();
    try {
      await mutate((t) =>
        api.createPlanned(t, {
          name: s.name,
          amount: s.medianAmount,
          startDate: s.nextExpected,
          frequency: s.interval === 'QUARTERLY' ? 'MONTHLY' : s.interval,
          categoryLabel: category,
          accountId: account,
        }),
      );
      toast.success('Planned', `${s.name} · ${s.interval.toLowerCase()}`);
    } catch (e) {
      toast.error('Could not plan', e instanceof Error ? e.message : 'Unknown error');
    }
  };
  const removeGoal = (g: Goal) =>
    void confirmDestructive(
      { title: `Delete the goal “${g.name}”?`, message: 'The money stays where it is.', confirmLabel: 'Delete' },
      () => mutate((t) => api.deleteGoal(t, g.id)),
      { onSuccess: () => toast.success('Deleted', g.name), onError: (m) => toast.error('Could not delete', m) },
    );

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.title, { color: theme.text }]}>Plan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.statRow}>
          <Stat label="In / month" value={mask(formatAmount(monthlyIn))} />
          <Stat label="Out / month" value={mask(formatAmount(monthlyOut))} />
          <Stat label="Saved / month" value={mask(formatAmount(monthlySave))} />
        </View>

        <Heading title="Next 45 days" />
        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.xs }}>
            {upcoming.length ? (
              upcoming.map((o, i) => (
                <View key={`${o.plannedId}-${o.date}`}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.row}>
                    <Text style={[type.caption, { color: o.overdue ? theme.negative : theme.textFaint, width: 64 }]} numberOfLines={1}>
                      {o.overdue ? 'OVERDUE' : relativeDays(o.date).toUpperCase()}
                    </Text>
                    <View style={[styles.swatch, { backgroundColor: o.categoryColor ?? theme.textFaint }]} />
                    <Text style={[type.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>{o.name}</Text>
                    <Text style={[type.amount, { color: o.kind === 'INCOME' ? theme.positive : theme.text }]}>
                      {o.kind === 'INCOME' ? '+' : o.kind === 'TRANSFER_OUT' ? '⇄ ' : '−'}{mask(formatAmount(o.amount), 'all')}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Empty text="Nothing due. Add rent, salary and subscriptions below." />
            )}
          </View>
        </Glass>

        <Heading title="Planned" action={adding === 'planned' ? 'Cancel' : 'Add'} onAction={() => setAdding(adding === 'planned' ? null : 'planned')} />
        {adding === 'planned' ? <PlannedForm onDone={() => setAdding(null)} /> : null}
        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.xs }}>
            {planned.length ? (
              planned.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable onLongPress={() => removePlanned(p)} style={[styles.row, { opacity: p.isActive ? 1 : 0.5 }]}>
                    <View style={[styles.swatch, { backgroundColor: p.kind === 'TRANSFER_OUT' ? theme.textFaint : categoryColor(theme, p.categoryLabel ?? '', p.categoryColor) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[type.caption, { color: theme.textFaint, marginTop: 2 }]}>
                        {p.frequency.toLowerCase()} · {p.nextDate ? relativeDays(p.nextDate) : '—'} · {p.kind === 'TRANSFER_OUT' ? `${p.accountName} → ${p.toAccountName}` : p.accountName}
                      </Text>
                    </View>
                    <Text style={[type.amount, { color: p.kind === 'INCOME' ? theme.positive : theme.text }]}>
                      {p.kind === 'INCOME' ? '+' : p.kind === 'TRANSFER_OUT' ? '' : '−'}{mask(formatAmount(p.amount), 'all')}
                    </Text>
                    <Pressable onPress={() => toggleAuto(p)} hitSlop={6} style={[styles.miniBtn, { borderColor: p.autoBook ? theme.text : theme.hairlineStrong, backgroundColor: p.autoBook ? theme.text : 'transparent' }]}>
                      <Text style={[type.caption, { color: p.autoBook ? theme.bgElevated : theme.textMuted }]}>AUTO</Text>
                    </Pressable>
                    <Pressable onPress={() => book(p)} hitSlop={6} style={[styles.miniBtn, { borderColor: theme.hairlineStrong }]}>
                      <Text style={[type.caption, { color: theme.text }]}>BOOK</Text>
                    </Pressable>
                  </Pressable>
                </View>
              ))
            ) : (
              <Empty text="Rent, salary, the savings transfer: plan them and the home screen knows what is safe to spend." />
            )}
          </View>
        </Glass>
        {planned.length ? <Hint text="Long-press a plan to delete it. AUTO books it on the day without asking." /> : null}

        <Heading title="Goals" action={adding === 'goal' ? 'Cancel' : 'Add'} onAction={() => setAdding(adding === 'goal' ? null : 'goal')} />
        {adding === 'goal' ? <GoalForm onDone={() => setAdding(null)} /> : null}
        {goals.map((g) => {
          const ratio = g.targetAmount > 0 ? Math.min(1, g.current / g.targetAmount) : 0;
          return (
            <Glass key={g.id} style={[styles.card, { marginBottom: space.md }]}>
              <Pressable onLongPress={() => removeGoal(g)} style={styles.cardInner}>
                <View style={styles.between}>
                  <Text style={[type.label, { color: theme.text }]}>{g.name}</Text>
                  <Text style={[type.caption, { color: g.achieved ? theme.positive : g.onTrack === false ? theme.negative : theme.textFaint }]}>
                    {g.achieved ? 'REACHED' : g.onTrack === false ? 'BEHIND' : g.onTrack ? 'ON TRACK' : ''}
                  </Text>
                </View>
                <View style={[styles.between, { alignItems: 'baseline', marginTop: 6 }]}>
                  <Text style={[type.display, { color: theme.text, fontSize: 30 }]}>{mask(formatAmount(g.current))}</Text>
                  <Text style={[type.label, { color: theme.textMuted }]}>of {formatAmount(g.targetAmount)}</Text>
                </View>
                <View style={[styles.track, { backgroundColor: theme.keypad }]}>
                  <View style={[styles.fill, { width: `${Math.max(2, ratio * 100)}%`, backgroundColor: theme.text }]} />
                </View>
                <Text style={[type.caption, { color: theme.textFaint, marginTop: 6 }]}>
                  {g.accountName ? `tracks ${g.accountName}` : 'manual'}
                  {g.targetDate ? ` · by ${g.targetDate}` : ''}
                  {g.requiredPerMonth !== null && !g.achieved ? ` · ${formatAmount(g.requiredPerMonth)}/month needed` : ''}
                </Text>
                {!g.achieved ? (
                  <Pressable onPress={() => setContributing(contributing?.id === g.id ? null : g)} style={[styles.action, { borderColor: theme.hairlineStrong, alignSelf: 'flex-start', marginTop: space.sm }]}>
                    <Text style={[type.label, { color: theme.text }]}>Add money</Text>
                  </Pressable>
                ) : null}
                {contributing?.id === g.id ? <Contribute goal={g} onDone={() => setContributing(null)} /> : null}
              </Pressable>
            </Glass>
          );
        })}
        {!goals.length && adding !== 'goal' ? <Glass style={styles.card}><Empty text="A goal is a target amount, optionally by a date. Link it to Sparkonto and it tracks that balance." /></Glass> : null}

        <Heading title="Subscriptions found" />
        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.xs }}>
            {subscriptions?.subscriptions.length ? (
              subscriptions.subscriptions.map((s, i) => (
                <View key={s.name}>
                  {i > 0 ? <Divider /> : null}
                  <View style={[styles.row, { opacity: s.active ? 1 : 0.5 }]}>
                    <View style={[styles.swatch, { backgroundColor: s.categoryColor ?? theme.textFaint }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[type.caption, { color: theme.textFaint, marginTop: 2 }]}>{s.interval.toLowerCase()} · {s.occurrences}× · next {relativeDays(s.nextExpected)}</Text>
                    </View>
                    <Text style={[type.amount, { color: theme.text }]}>{mask(formatAmount(s.medianAmount), 'all')}</Text>
                    {s.planned ? (
                      <Ionicons name="checkmark-circle" size={18} color={theme.positive} />
                    ) : s.active ? (
                      <Pressable onPress={() => planSubscription(s)} hitSlop={6} style={[styles.miniBtn, { borderColor: theme.hairlineStrong }]}>
                        <Text style={[type.caption, { color: theme.text }]}>PLAN</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Empty text="Nothing recurring detected yet — it takes three payments of the same thing at a steady interval." />
            )}
          </View>
        </Glass>
        {subscriptions ? <Hint text={`${formatAmount(subscriptions.monthlyTotal)} ${prefs.currency} a month · ${formatAmount(subscriptions.yearlyTotal)} a year`} /> : null}
      </ScrollView>
    </Screen>
  );
}

function PlannedForm({ onDone }: { onDone: () => void }) {
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

function GoalForm({ onDone }: { onDone: () => void }) {
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

function Contribute({ goal, onDone }: { goal: Goal; onDone: () => void }) {
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

// ---- small shared pieces

function Heading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}><Text style={[type.label, { color: theme.textMuted }]}>{action}</Text></Pressable>
      ) : null}
    </View>
  );
}
function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.hairline, marginLeft: space.lg }} />;
}
function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>{text}</Text>;
}
function Hint({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[type.caption, { color: theme.textFaint, paddingHorizontal: space.xl, marginTop: space.sm }]}>{text}</Text>;
}
function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{label}</Text>
      <Text style={[type.amount, { color: theme.text, fontSize: 20, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}
function Segment({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { borderColor: theme.hairline }]}>
      {options.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[styles.segmentItem, value === k ? { backgroundColor: theme.text } : null]}>
          <Text style={[type.label, { color: value === k ? theme.bgElevated : theme.textMuted }]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}
function Pills({ items, selected, onSelect }: { items: { key: string; label: string }[]; selected: string | null; onSelect: (k: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {items.map((it) => (
        <Pressable key={it.key} onPress={() => onSelect(it.key)} style={[styles.pill, { backgroundColor: selected === it.key ? theme.text : theme.keypad, borderColor: selected === it.key ? theme.text : theme.hairline }]}>
          <Text style={[type.label, { color: selected === it.key ? theme.bgElevated : theme.textMuted }]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.md },
  statRow: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, marginTop: space.sm },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.md },
  card: { marginHorizontal: space.lg },
  cardInner: { padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  miniBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 4, marginLeft: 2 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 2 },
  action: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16 },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
});
