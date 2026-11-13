import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { GoalForm, PlannedForm } from '../../src/components/PlanForms';
import { Btn, Card, Divider, Empty, Hint, Meter, Section, Segment, Swatch } from '../../src/components/ui';
import { useToast } from '../../src/components/Toast';
import { useApp } from '../../src/store';
import {
  dayOf,
  formatAmount,
  isoDay,
  mergePots,
  relativeDays,
  type Occurrence,
  type Pot,
  type Subscription,
} from '../../src/core';
import { api } from '../../src/api';
import { usePlanActions } from '../../src/actions';
import { dayLabel, monthKey, monthTitle, shiftMonthKey, todayIso } from '../../src/lib/dates';
import { usePreferences, useTheme } from '../../src/preferences';
import { categoryColor, radius, space, type } from '../../src/theme';

type View_ = 'ahead' | 'pots' | 'subs';

/**
 * What is ahead: planned items as a list or a calendar (book, skip, move), every plan,
 * the pots (budgets and goals in one list) and the subscriptions the history reveals.
 */
export default function Plan() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; day?: string }>();
  const { prefs, tick, mask } = usePreferences();
  const { planned, upcoming, goals, progress, subscriptions, accounts, categories, refreshing, refresh, mutate } = useApp();
  const toast = useToast();
  const actions = usePlanActions();

  const [view, setView] = useState<View_>(params.view === 'pots' ? 'pots' : params.view === 'subs' ? 'subs' : 'ahead');
  const [mode, setMode] = useState<'list' | 'calendar'>(params.day ? 'calendar' : 'list');
  const [selectedDay, setSelectedDay] = useState<string>(params.day ?? todayIso());
  const [month, setMonth] = useState(monthKey(new Date()));
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<null | 'planned' | 'goal'>(null);

  useEffect(() => {
    if (params.view === 'pots') setView('pots');
    if (params.view === 'subs') setView('subs');
    if (params.day) {
      setView('ahead');
      setMode('calendar');
      setSelectedDay(params.day);
      setMonth(params.day.slice(0, 7));
    }
  }, [params.view, params.day]);

  const today = todayIso();
  const monthlyOut = planned.filter((p) => p.isActive && p.kind === 'EXPENSE').reduce((s, p) => s + p.monthlyEquivalent, 0);
  const monthlyIn = planned.filter((p) => p.isActive && p.kind === 'INCOME').reduce((s, p) => s + p.monthlyEquivalent, 0);
  const monthlySave = planned.filter((p) => p.isActive && p.kind === 'TRANSFER_OUT').reduce((s, p) => s + p.monthlyEquivalent, 0);

  // Overdue first (they land on today), then by date.
  const ordered = useMemo(
    () =>
      [...upcoming].sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.date.localeCompare(b.date);
      }),
    [upcoming],
  );
  // Only a plan's earliest unbooked occurrence can be skipped or moved.
  const firstOfPlan = useMemo(() => {
    const seen = new Set<string>();
    const out = new Set<string>();
    for (const o of ordered) {
      if (seen.has(o.plannedId)) continue;
      seen.add(o.plannedId);
      out.add(`${o.plannedId}-${o.date}`);
    }
    return out;
  }, [ordered]);

  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of ordered) {
      let k = dayOf(o.date);
      if (k < today) k = today;
      const list = m.get(k);
      if (list) list.push(o);
      else m.set(k, [o]);
    }
    return m;
  }, [ordered, today]);

  const pots = useMemo(() => mergePots(progress, goals), [progress, goals]);

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

  const occurrenceRow = (o: Occurrence, i: number, showDate: boolean) => {
    const key = `${o.plannedId}-${o.date}`;
    const movable = firstOfPlan.has(key);
    const due = !o.autoBook && (o.overdue || dayOf(o.date) <= today);
    const isOpen = open === key;
    return (
      <View key={key}>
        {i > 0 ? <Divider /> : null}
        <Pressable
          onPress={() => {
            tick();
            setOpen(isOpen ? null : key);
          }}
          style={styles.row}
        >
          {showDate ? (
            <Text style={[type.caption, { color: o.overdue ? theme.negative : theme.textFaint, width: 66 }]} numberOfLines={1}>
              {o.overdue ? 'OVERDUE' : dayLabel(o.date)}
            </Text>
          ) : null}
          <Swatch
            color={o.kind === 'INCOME' ? theme.positive : o.kind === 'TRANSFER_OUT' ? theme.textFaint : categoryColor(theme, o.categoryLabel ?? o.name, o.categoryColor)}
          />
          <View style={{ flex: 1 }}>
            <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
              {o.name}
            </Text>
            <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
              {o.toAccountName ? `${o.accountName} → ${o.toAccountName}` : `${o.categoryLabel ?? '—'} · ${o.accountName}`}
              {o.autoBook ? ' · auto' : ''}
            </Text>
          </View>
          <Text style={[type.amount, { color: o.kind === 'INCOME' ? theme.positive : theme.text, fontSize: 15 }]}>
            {o.kind === 'INCOME' ? '+' : o.kind === 'TRANSFER_OUT' ? '⇄ ' : '−'}
            {mask(formatAmount(o.amount), 'all')}
          </Text>
          {due ? <Btn small primary={o.overdue} label="Book" onPress={() => void actions.book(o)} /> : null}
        </Pressable>
        {isOpen ? (
          <View style={styles.rowActions}>
            {movable ? (
              <>
                <Btn small icon="play-skip-forward-outline" label="Skip" onPress={() => void actions.skip(o).then(() => setOpen(null))} />
                <Btn small icon="arrow-forward-outline" label="+1 week" onPress={() => void actions.postpone(o, 7).then(() => setOpen(null))} />
                <Btn small icon="calendar-outline" label="+1 month" onPress={() => void actions.postpone(o, 30).then(() => setOpen(null))} />
              </>
            ) : null}
            <Btn small icon="open-outline" label="Details" onPress={() => router.push(`/planned/${o.plannedId}`)} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textMuted} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Text style={[type.title, { color: theme.text, flex: 1 }]}>Plan</Text>
          <Btn small icon="add" label="Plan" onPress={() => { setView('ahead'); setAdding(adding === 'planned' ? null : 'planned'); }} />
          <Btn small icon="add" label="Goal" onPress={() => { setView('pots'); setAdding(adding === 'goal' ? null : 'goal'); }} />
        </View>

        <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
          <Segment<View_>
            options={[
              ['ahead', 'Ahead'],
              ['pots', `Pots · ${pots.length}`],
              ['subs', 'Subscriptions'],
            ]}
            value={view}
            onChange={setView}
          />
        </View>

        {view === 'ahead' ? (
          <>
            <View style={styles.stats}>
              <Stat label="In / month" value={mask(formatAmount(monthlyIn))} color={theme.positive} />
              <Stat label="Out / month" value={mask(formatAmount(monthlyOut))} />
              <Stat label="Saved / month" value={mask(formatAmount(monthlySave))} />
            </View>

            {adding === 'planned' ? (
              <View style={{ marginTop: space.lg }}>
                <PlannedForm onDone={() => setAdding(null)} />
              </View>
            ) : null}

            <Section
              title={mode === 'list' ? 'Next 60 days' : monthTitle(month)}
              detail={`${upcoming.filter((o) => o.overdue).length ? `${upcoming.filter((o) => o.overdue).length} overdue` : ''}`}
              detailColor={theme.negative}
              action={mode === 'list' ? 'Calendar' : 'List'}
              onAction={() => setMode(mode === 'list' ? 'calendar' : 'list')}
            />

            {mode === 'list' ? (
              <Card padded={false}>
                {ordered.length ? ordered.map((o, i) => occurrenceRow(o, i, true)) : <Empty text="Nothing due. Add rent, salary and subscriptions with + Plan." />}
              </Card>
            ) : (
              <>
                <Calendar
                  month={month}
                  onMonth={setMonth}
                  selected={selectedDay}
                  onSelect={setSelectedDay}
                  byDay={byDay}
                />
                <Section
                  title={selectedDay === today ? 'Today' : new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                />
                <Card padded={false}>
                  {(byDay.get(selectedDay) ?? []).length ? (
                    (byDay.get(selectedDay) ?? []).map((o, i) => occurrenceRow(o, i, false))
                  ) : (
                    <Empty text="Nothing planned that day." />
                  )}
                </Card>
              </>
            )}
            <Hint text="Tap a row to skip it or move it. Book posts it now." />

            <Section title="All plans" detail={`${planned.filter((p) => p.isActive).length} active`} />
            <Card padded={false}>
              {planned.length ? (
                planned.map((p, i) => (
                  <View key={p.id}>
                    {i > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => {
                        tick();
                        router.push(`/planned/${p.id}`);
                      }}
                      style={({ pressed }) => [styles.row, { opacity: p.isActive ? (pressed ? 0.6 : 1) : 0.5 }]}
                    >
                      <Swatch color={p.kind === 'INCOME' ? theme.positive : p.kind === 'TRANSFER_OUT' ? theme.textFaint : categoryColor(theme, p.categoryLabel ?? '', p.categoryColor)} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
                          {p.frequency.toLowerCase()} · {p.nextDate ? relativeDays(p.nextDate) : 'ended'} ·{' '}
                          {p.kind === 'TRANSFER_OUT' ? `${p.accountName} → ${p.toAccountName}` : p.accountName}
                          {p.autoBook ? ' · auto' : ''}
                        </Text>
                      </View>
                      <Text style={[type.amount, { color: p.kind === 'INCOME' ? theme.positive : theme.text, fontSize: 15 }]}>
                        {p.kind === 'INCOME' ? '+' : p.kind === 'TRANSFER_OUT' ? '' : '−'}
                        {mask(formatAmount(p.amount), 'all')}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={theme.textFaint} />
                    </Pressable>
                  </View>
                ))
              ) : (
                <Empty text="Rent, salary, the savings transfer: plan them and Today knows what is safe to spend." />
              )}
            </Card>
          </>
        ) : null}

        {view === 'pots' ? (
          <>
            {adding === 'goal' ? (
              <View style={{ marginTop: space.lg }}>
                <GoalForm onDone={() => setAdding(null)} />
              </View>
            ) : null}
            <Section title="Budgets and goals" action="Manage budgets" onAction={() => router.push('/budgets')} />
            <View style={{ gap: space.sm }}>
              {pots.map((p) => (
                <PotCard key={`${p.kind}-${p.id}`} pot={p} onPress={() => router.push({ pathname: '/pot/[id]', params: { id: p.id, kind: p.kind } })} />
              ))}
              {pots.length === 0 ? (
                <Card>
                  <Text style={[type.label, { color: theme.textFaint }]}>
                    No pots yet. A budget caps a category each month; a goal saves towards an amount. Add a goal above or set a budget under Manage budgets.
                  </Text>
                </Card>
              ) : null}
            </View>
          </>
        ) : null}

        {view === 'subs' ? (
          <>
            {subscriptions ? (
              <View style={styles.stats}>
                <Stat label="Active" value={String(subscriptions.activeCount)} />
                <Stat label="A month" value={mask(formatAmount(subscriptions.monthlyTotal), 'all')} />
                <Stat label="A year" value={mask(formatAmount(subscriptions.yearlyTotal), 'all')} />
              </View>
            ) : null}
            <Section title="Found in your history" />
            <Card padded={false}>
              {subscriptions?.subscriptions.length ? (
                subscriptions.subscriptions.map((s, i) => (
                  <View key={s.name}>
                    {i > 0 ? <Divider /> : null}
                    <View style={[styles.row, { opacity: s.active ? 1 : 0.5 }]}>
                      <Swatch color={categoryColor(theme, s.categoryLabel ?? s.name, s.categoryColor)} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
                          {s.name}
                        </Text>
                        <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
                          {s.interval.toLowerCase()} · {s.occurrences}× · next {relativeDays(s.nextExpected)} · {mask(formatAmount(s.paidLast12Months), 'all')} / 12 mo
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[type.amount, { color: theme.text, fontSize: 15 }]}>{mask(formatAmount(s.medianAmount), 'all')}</Text>
                        <Text style={[type.caption, { color: theme.textFaint }]}>{mask(formatAmount(s.monthlyEquivalent), 'all')}/mo</Text>
                      </View>
                      {s.planned ? (
                        <Ionicons name="checkmark-circle" size={18} color={theme.positive} />
                      ) : s.active ? (
                        <Btn small label="Plan" onPress={() => void planSubscription(s)} />
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Empty text="Nothing recurring detected yet. It takes three payments of the same thing at a steady interval." />
              )}
            </Card>
            <Hint text="Plan turns a subscription into a planned item, so safe to spend counts it." />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PotCard({ pot, onPress }: { pot: Pot; onPress: () => void }) {
  const theme = useTheme();
  const { mask, tick } = usePreferences();
  const tone = pot.status === 'over' || pot.status === 'behind' ? 'over' : pot.status === 'warn' ? 'warn' : pot.status === 'done' ? 'ok' : 'ink';
  const statusText =
    pot.kind === 'budget'
      ? pot.status === 'over'
        ? `${formatAmount(-pot.remaining)} over`
        : `${formatAmount(pot.remaining)} left · ${pot.budget.daysLeft} d`
      : pot.status === 'done'
        ? 'reached'
        : pot.status === 'behind'
          ? 'behind'
          : pot.goal.requiredPerMonth
            ? `${formatAmount(pot.goal.requiredPerMonth)}/mo needed`
            : `${formatAmount(pot.remaining)} to go`;
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={({ pressed }) => [styles.pot, { backgroundColor: theme.bgElevated, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.between}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
          <Swatch color={categoryColor(theme, pot.name, pot.color)} />
          <Text style={[type.body, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
            {pot.name}
          </Text>
          <Text style={[type.caption, { color: theme.textFaint }]}>{pot.kind === 'budget' ? pot.budget.period.toLowerCase() : 'goal'}</Text>
        </View>
        <Text style={[type.label, { color: tone === 'over' ? theme.negative : theme.textMuted }]}>
          {mask(formatAmount(pot.current), pot.kind === 'goal' ? 'balances' : 'all')} / {formatAmount(pot.target)}
        </Text>
      </View>
      <Meter ratio={pot.ratio} tone={tone} height={5} style={{ marginTop: 8 }} />
      <Text style={[type.caption, { color: tone === 'over' ? theme.negative : theme.textFaint, marginTop: 4, letterSpacing: 0.2 }]}>
        {statusText}
      </Text>
    </Pressable>
  );
}

/** Month grid, Monday first. Dots mark planned items; overdue ones sit on today. */
function Calendar({
  month,
  onMonth,
  selected,
  onSelect,
  byDay,
}: {
  month: string;
  onMonth: (m: string) => void;
  selected: string;
  onSelect: (d: string) => void;
  byDay: Map<string, Occurrence[]>;
}) {
  const theme = useTheme();
  const { tick } = usePreferences();
  const today = todayIso();
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(isoDay(new Date(y, m - 1, d)));
  while (cells.length % 7) cells.push(null);

  return (
    <Card>
      <View style={[styles.between, { marginBottom: space.sm }]}>
        <Pressable onPress={() => onMonth(shiftMonthKey(month, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={18} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.label, { color: theme.text }]}>{monthTitle(month)}</Text>
        <Pressable onPress={() => onMonth(shiftMonthKey(month, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
      <View style={styles.calRow}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <Text key={d} style={[type.caption, styles.calHead, { color: theme.textFaint }]}>
            {d}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.calRow}>
          {cells.slice(w * 7, w * 7 + 7).map((iso, i) => {
            if (!iso) return <View key={i} style={styles.calCell} />;
            const items = byDay.get(iso) ?? [];
            const isSel = iso === selected;
            const net = items.reduce((s, o) => s + (o.kind === 'INCOME' ? o.amount : o.kind === 'TRANSFER_IN' ? 0 : -o.amount), 0);
            return (
              <Pressable
                key={iso}
                onPress={() => {
                  tick();
                  onSelect(iso);
                }}
                style={[
                  styles.calCell,
                  {
                    backgroundColor: isSel ? theme.text : 'transparent',
                    borderColor: iso === today && !isSel ? theme.text : 'transparent',
                  },
                ]}
              >
                <Text style={[type.label, { color: isSel ? theme.bg : iso < today ? theme.textFaint : theme.text }]}>{Number(iso.slice(8))}</Text>
                <View style={{ flexDirection: 'row', gap: 2, height: 5, marginTop: 2 }}>
                  {items.slice(0, 3).map((o) => (
                    <View
                      key={`${o.plannedId}-${o.date}`}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: isSel ? theme.bg : o.overdue ? theme.negative : o.kind === 'INCOME' ? theme.positive : theme.accent,
                      }}
                    />
                  ))}
                </View>
                {items.length ? (
                  <Text style={{ fontSize: 8.5, color: isSel ? theme.bg : net > 0 ? theme.positive : theme.textFaint }} numberOfLines={1}>
                    {net > 0 ? '+' : '−'}
                    {Math.abs(net) >= 1000 ? `${(Math.abs(net) / 1000).toFixed(1)}k` : Math.round(Math.abs(net))}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={[type.caption, { color: theme.textFaint, marginTop: space.sm, letterSpacing: 0.2 }]}>
        Shows the next 60 days of plans.
      </Text>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{label}</Text>
      <Text style={[type.amount, { color: color ?? theme.text, fontSize: 19, marginTop: 4 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, gap: space.sm },
  stats: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, marginTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md, paddingLeft: 90 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  pot: { marginHorizontal: space.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space.md },
  calRow: { flexDirection: 'row' },
  calHead: { flex: 1, textAlign: 'center', letterSpacing: 0, marginBottom: 4 },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, minHeight: 46 },
});
