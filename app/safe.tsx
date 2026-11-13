import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../src/components/Screen';
import { Sparkline } from '../src/components/charts';
import { Card, Empty, Header, KV, Meter, Section, ui } from '../src/components/ui';
import { useApp } from '../src/store';
import { dailyAllowance, dayOf, formatAmount, formatShortDate, projectBalance } from '../src/core';
import { usePreferences, useTheme } from '../src/preferences';
import { space, type } from '../src/theme';

/** How safe to spend is worked out: on hand, minus what is committed, spread over the days. */
export default function SafeDetail() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { safe, accounts, transactions, upcoming } = useApp();
  const { mask } = usePreferences();

  const allowance = useMemo(() => dailyAllowance(safe, transactions), [safe, transactions]);
  const scope = useMemo(() => {
    const ids = safe?.accountIds?.length ? new Set(safe.accountIds) : null;
    return accounts.filter((a) => (ids ? ids.has(a.id) : a.spending !== false));
  }, [accounts, safe]);
  const projection = useMemo(() => projectBalance(scope, upcoming, 30), [scope, upcoming]);

  if (!safe) {
    return (
      <Screen>
        <Header title="Safe to spend" />
        <Empty text="Safe to spend needs planned items. Add your salary and fixed costs under Plan." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Safe to spend" subtitle={`until ${formatShortDate(safe.horizon)} · ${safe.horizonReason}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <Section title="Today" />
        <Card>
          <KV label="Allowance for today" value={mask(formatAmount(allowance.perDay))} />
          <KV label="Spent today" value={`−${mask(formatAmount(allowance.spentToday), 'all')}`} />
          <KV label="Left today" strong value={`${allowance.leftToday < 0 ? '−' : ''}${mask(formatAmount(allowance.leftToday))}`} color={allowance.over ? theme.negative : theme.positive} />
          <Meter ratio={allowance.ratio} tone={allowance.over ? 'over' : allowance.ratio >= 0.8 ? 'warn' : 'ok'} style={{ marginTop: space.sm }} />
          <Text style={[type.caption, { color: theme.textFaint, marginTop: space.sm, letterSpacing: 0.2 }]}>
            Fixed each morning: what is free until the horizon, divided by the days left. Unspent money rolls into the next days.
          </Text>
        </Card>

        <Section title={`Until ${formatShortDate(safe.horizon)}`} detail={`${safe.daysToHorizon} days`} />
        <Card>
          {scope.map((a) => (
            <KV key={a.id} label={a.accountName} value={mask(formatAmount(a.baseBalance ?? a.currentBalance))} onPress={() => router.push(`/account/${a.id}`)} />
          ))}
          <KV label="On hand" strong value={mask(formatAmount(safe.balance))} />
          <KV label="Planned expenses" value={`−${mask(formatAmount(safe.upcomingExpenses), 'all')}`} />
          <KV label="Planned transfers to savings" value={`−${mask(formatAmount(safe.upcomingTransfersOut), 'all')}`} />
          <KV label="Free until then" strong value={`${safe.safeToSpend < 0 ? '−' : ''}${mask(formatAmount(safe.safeToSpend))}`} color={safe.safeToSpend < 0 ? theme.negative : undefined} />
          <KV label="Per day right now" value={mask(formatAmount(safe.perDay))} />
        </Card>

        <Section title="Committed" detail={`${safe.upcoming.length} items`} action="Plan →" onAction={() => router.push('/plan')} />
        <Card>
          {safe.upcoming.length ? (
            safe.upcoming.map((o) => (
              <KV
                key={`${o.plannedId}-${o.date}`}
                label={`${formatShortDate(dayOf(o.date))} · ${o.name}${o.overdue ? ' (overdue)' : ''}`}
                value={`${o.kind === 'INCOME' ? '+' : '−'}${mask(formatAmount(o.amount), 'all')}`}
                color={o.overdue ? theme.negative : undefined}
                onPress={() => router.push(`/planned/${o.plannedId}`)}
              />
            ))
          ) : (
            <Text style={[type.label, { color: theme.textFaint }]}>Nothing committed before the horizon.</Text>
          )}
        </Card>

        <Section title="Projected balance · 30 days" />
        <Card>
          <Sparkline values={projection.points.map((p) => p.balance)} color={theme.text} height={80} />
          <View style={[ui.between, { marginTop: space.xs }]}>
            <Text style={[type.caption, { color: theme.textFaint }]}>today {mask(formatAmount(projection.start))}</Text>
            <Text style={[type.caption, { color: projection.lowest.balance < 0 ? theme.negative : theme.textFaint }]}>
              lowest {projection.lowest.balance < 0 ? '−' : ''}
              {mask(formatAmount(projection.lowest.balance))} on {formatShortDate(projection.lowest.date)}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
