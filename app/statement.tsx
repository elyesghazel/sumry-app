import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { RankedBars } from '../src/components/charts';
import { DeltaPercent } from '../src/components/Delta';
import { Btn, Card, Empty, Header, KV, Section, ui } from '../src/components/ui';
import { useToast } from '../src/components/Toast';
import { useConfirm } from '../src/components/ConfirmDialog';
import { useApp } from '../src/store';
import { formatAmount, maskIbansIn, pctChange, type Statement } from '../src/core';
import { api } from '../src/api';
import { monthKey, monthTitle, shiftMonthKey, shortDay } from '../src/lib/dates';
import { usePreferences, useTheme } from '../src/preferences';
import { categoryColor, space, type } from '../src/theme';

/** The monthly statement, rendered natively from /statement, and sent by mail on request. */
export default function StatementScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string }>();
  const { token, user } = useApp();
  const { prefs, mask } = usePreferences();
  const toast = useToast();
  const confirm = useConfirm();

  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(params.month ?? shiftMonthKey(thisMonth, -1));
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) return;
    setData(null);
    setError(null);
    api
      .statement(token, month)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the statement'));
  }, [token, month]);

  useEffect(() => {
    if (!token) return;
    api
      .mailStatus(token)
      .then((s) => setMail(s.configured))
      .catch(() => setMail(false));
  }, [token]);

  const send = async () => {
    if (!token) return;
    const ok = await confirm({
      title: 'Email this statement?',
      message: `${monthTitle(month)} goes to ${user?.email ?? 'your address'}.`,
      confirmLabel: 'Send',
      icon: 'mail-outline',
    });
    if (!ok) return;
    setSending(true);
    try {
      const res = await api.sendStatement(token, month);
      toast.success('Statement sent', res.sentTo);
    } catch (e) {
      toast.error('Could not send', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen>
      <Header title="Statement" subtitle={monthTitle(month)} />
      <View style={[ui.between, { paddingHorizontal: space.xl, paddingBottom: space.sm }]}>
        <Pressable onPress={() => setMonth(shiftMonthKey(month, -1))} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Ionicons name="chevron-back" size={16} color={theme.textMuted} />
          <Text style={[type.label, { color: theme.textMuted }]}>{monthTitle(shiftMonthKey(month, -1)).split(' ')[0]}</Text>
        </Pressable>
        <Btn small icon="mail-outline" label={sending ? 'Sending…' : 'Email'} disabled={!mail || sending || !data} onPress={send} />
        <Pressable
          onPress={() => month < thisMonth && setMonth(shiftMonthKey(month, 1))}
          hitSlop={10}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, opacity: month < thisMonth ? 1 : 0.3 }}
        >
          <Text style={[type.label, { color: theme.textMuted }]}>{monthTitle(shiftMonthKey(month, 1)).split(' ')[0]}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        {error ? <Empty text={error} /> : null}
        {!data && !error ? <ActivityIndicator color={theme.textMuted} style={{ marginTop: space.xxl }} /> : null}
        {data ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row' }}>
                <Big label="In" value={mask(formatAmount(data.income), 'all')} color={theme.positive} foot={<DeltaPercent value={pctChange(data.income, data.previousIncome)} />} />
                <Big label="Out" value={mask(formatAmount(data.expense), 'all')} color={theme.negative} foot={<DeltaPercent value={pctChange(data.expense, data.previousExpense)} invert />} />
              </View>
              <View style={{ flexDirection: 'row', marginTop: space.md }}>
                <Big label="Net" value={`${data.net < 0 ? '−' : '+'}${mask(formatAmount(data.net), 'all')}`} color={data.net < 0 ? theme.negative : theme.positive} />
                <Big label="Saved" value={data.savingsRate === null ? '—' : `${Math.round(data.savingsRate * 100)}%`} />
              </View>
              <Text style={[type.caption, { color: theme.textFaint, marginTop: space.md, letterSpacing: 0.2 }]}>
                {shortDay(data.from)} – {shortDay(data.to)} · {data.entryCount} entries · {data.baseCurrency}
              </Text>
            </Card>

            <Section title="Where it went" />
            <Card>
              {data.byCategory.length ? (
                <RankedBars
                  currency={prefs.currency}
                  data={data.byCategory.slice(0, 8).map((c) => ({ label: c.label, value: c.amount, share: c.share, color: categoryColor(theme, c.label, c.color) }))}
                  onPress={(label) => router.push({ pathname: '/category/[label]', params: { label } })}
                />
              ) : (
                <Text style={[type.label, { color: theme.textFaint }]}>Nothing spent this month.</Text>
              )}
            </Card>

            {data.budgets.length ? (
              <>
                <Section title="Budgets" detail={`${data.budgets.filter((b) => b.over).length} over`} detailColor={theme.negative} />
                <Card>
                  {data.budgets.map((b) => (
                    <KV key={b.category} label={b.category} value={`${mask(formatAmount(b.spent), 'all')} / ${formatAmount(b.limit)}`} color={b.over ? theme.negative : undefined} />
                  ))}
                </Card>
              </>
            ) : null}

            <Section title="Largest" />
            <Card>
              {data.largest.map((l, i) => (
                <KV key={i} label={`${shortDay(l.date)} · ${maskIbansIn(l.description ?? l.category ?? '—')}`} value={mask(formatAmount(l.amount), 'all')} />
              ))}
              {data.largest.length === 0 ? <Text style={[type.label, { color: theme.textFaint }]}>No entries.</Text> : null}
            </Card>

            <Section title="Accounts" />
            <Card>
              {data.accounts.map((a) => (
                <KV
                  key={a.name}
                  label={`${a.name}  ${a.change >= 0 ? '+' : '−'}${mask(formatAmount(a.change), 'all')}`}
                  value={`${mask(formatAmount(a.balance))}${a.currency !== data.baseCurrency ? ` ${a.currency}` : ''}`}
                />
              ))}
              <KV label="Net worth" strong value={mask(formatAmount(data.netWorth))} />
              <KV label="Change" value={`${data.netWorthChange >= 0 ? '+' : '−'}${mask(formatAmount(data.netWorthChange), 'all')}`} color={data.netWorthChange >= 0 ? theme.positive : theme.negative} />
              <KV label="Subscriptions a month" value={mask(formatAmount(data.subscriptionsMonthly), 'all')} />
            </Card>
            {mail === false ? (
              <Text style={[type.caption, { color: theme.textFaint, paddingHorizontal: space.xl, marginTop: space.sm }]}>
                Mail isn't set up on this server, so Email is off.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Big({ label, value, color, foot }: { label: string; value: string; color?: string; foot?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[type.caption, { color: theme.textFaint }]}>{label.toUpperCase()}</Text>
      <Text style={[type.amount, { color: color ?? theme.text, fontSize: 22, marginVertical: 2 }]}>{value}</Text>
      {foot}
    </View>
  );
}
