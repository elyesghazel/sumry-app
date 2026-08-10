import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Divider, Group, LinkRow, SegmentRow, SwitchRow } from '../../src/components/Rows';
import { useApp } from '../../src/store';
import { API_URL, api } from '../../src/api';
import { TIMEFRAMES, usePreferences, useTheme } from '../../src/preferences';
import { formatAmount } from '../../src/format';
import { ThemeMode } from '../../src/theme';
import { radius, space, type } from '../../src/theme';

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, reset } = usePreferences();
  const { user, accounts, categories, transactions, signOut, mutate } = useApp();

  const [addingAccount, setAddingAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  const addAccount = async () => {
    const name = accountName.trim();
    const balance = Number.parseFloat(openingBalance || '0');
    if (!name || !Number.isFinite(balance)) return;
    try {
      await mutate((t) => api.createAccount(t, name, balance));
      setAddingAccount(false);
      setAccountName('');
      setOpeningBalance('');
    } catch (e) {
      Alert.alert('Could not add account', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const removeAccount = (id: string, name: string) =>
    Alert.alert('Delete account?', `${name} and its transactions will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          mutate((t) => api.deleteAccount(t, id)).catch((e) =>
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Unknown error'),
          ),
      },
    ]);

  const defaultAccountName =
    accounts.find((a) => a.id === prefs.defaultAccountId)?.accountName ?? 'First account';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: insets.bottom + 96,
        }}
      >
        <Text style={[type.title, { color: theme.text, paddingHorizontal: space.xl }]}>
          Settings
        </Text>

        <Group title="Account">
          <View style={styles.identity}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={[type.title, { color: '#fff' }]}>
                {(user?.username ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: theme.text }]}>{user?.username ?? '—'}</Text>
              <Text style={[type.label, { color: theme.textFaint, marginTop: 2 }]}>
                {user?.email ?? ''}
              </Text>
            </View>
          </View>
          <Divider />
          <LinkRow
            icon="key-outline"
            label="Change password"
            onPress={() => router.push('/settings/password')}
          />
        </Group>

        <Group title="Appearance">
          <SegmentRow<ThemeMode>
            label="Theme"
            value={prefs.themeMode}
            onChange={(v) => set('themeMode', v)}
            options={[
              { key: 'system', label: 'System' },
              { key: 'light', label: 'Light' },
              { key: 'dark', label: 'Dark' },
            ]}
          />
          <Divider />
          <SwitchRow
            icon="phone-portrait-outline"
            label="Haptics"
            hint="Vibrate on keypad and selections"
            value={prefs.haptics}
            onChange={(v) => set('haptics', v)}
          />
        </Group>

        <Group title="Money">
          <SegmentRow
            label="Currency"
            value={prefs.currency}
            onChange={(v) => set('currency', v)}
            options={CURRENCIES.map((c) => ({ key: c, label: c }))}
          />
          <Divider />
          <LinkRow
            icon="wallet-outline"
            label="Default account"
            value={defaultAccountName}
            onPress={() => {
              // Cycle through accounts, ending back at "first account".
              const ids: (string | null)[] = [...accounts.map((a) => a.id), null];
              const i = ids.indexOf(prefs.defaultAccountId);
              set('defaultAccountId', ids[(i + 1) % ids.length]);
            }}
          />
          <Divider />
          <LinkRow
            icon="time-outline"
            label="Default period"
            value={TIMEFRAMES.find((t) => t.key === prefs.timeframe)?.label}
            onPress={() => {
              const i = TIMEFRAMES.findIndex((t) => t.key === prefs.timeframe);
              set('timeframe', TIMEFRAMES[(i + 1) % TIMEFRAMES.length].key);
            }}
          />
        </Group>

        <Group title="Accounts">
          {accounts.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable onLongPress={() => removeAccount(a.id, a.accountName)} style={styles.row}>
                <View
                  style={[
                    styles.accountDot,
                    { backgroundColor: theme.categorical[i % theme.categorical.length] },
                  ]}
                />
                <Text style={[type.body, { color: theme.text, flex: 1 }]}>{a.accountName}</Text>
                <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>
                  {formatAmount(a.currentBalance ?? 0)}
                </Text>
              </Pressable>
            </View>
          ))}

          {addingAccount ? (
            <View style={{ padding: space.lg, gap: space.sm }}>
              <TextInput
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Account name"
                placeholderTextColor={theme.textFaint}
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
                ]}
              />
              <TextInput
                value={openingBalance}
                onChangeText={setOpeningBalance}
                placeholder="Opening balance"
                placeholderTextColor={theme.textFaint}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
                ]}
              />
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Pressable
                  onPress={() => setAddingAccount(false)}
                  style={[styles.action, { borderColor: theme.hairline }]}
                >
                  <Text style={[type.label, { color: theme.textMuted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={addAccount}
                  style={[styles.action, { backgroundColor: theme.text, borderColor: theme.text }]}
                >
                  <Text style={[type.label, { color: theme.bg }]}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Divider />
              <Pressable onPress={() => setAddingAccount(true)} style={styles.row}>
                <Ionicons name="add" size={18} color={theme.textMuted} />
                <Text style={[type.label, { color: theme.textMuted }]}>Add account</Text>
              </Pressable>
            </>
          )}
        </Group>
        <Hint text="Long-press an account to delete it." />

        <Group title="Organise">
          <LinkRow
            icon="pricetags-outline"
            label="Categories"
            value={`${categories.length}`}
            onPress={() => router.push('/settings/categories')}
          />
          <Divider />
          <LinkRow
            icon="options-outline"
            label="Insight cards"
            value={`${prefs.cards.length} shown`}
            onPress={() => router.push('/settings/insights')}
          />
        </Group>

        <Group title="Transactions list">
          <SwitchRow
            label="Group by day"
            hint="Show day headers with running totals"
            value={prefs.groupByDay}
            onChange={(v) => set('groupByDay', v)}
          />
          <Divider />
          <SwitchRow
            label="Show balance after"
            hint="Display the account balance on each row"
            value={prefs.showRunningBalance}
            onChange={(v) => set('showRunningBalance', v)}
          />
        </Group>

        <Group title="Data">
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Stat label="Transactions" value={String(transactions.length)} />
            <Stat label="Categories" value={String(categories.length)} />
            <Stat label="Accounts" value={String(accounts.length)} />
            <Stat label="Server" value={API_URL.replace(/^https?:\/\//, '')} />
          </View>
        </Group>

        <Pressable
          onPress={() =>
            Alert.alert('Reset preferences?', 'Your data is not affected.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: reset },
            ])
          }
          style={[styles.footerAction, { borderColor: theme.hairline }]}
        >
          <Text style={[type.label, { color: theme.textMuted }]}>Reset preferences</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={[styles.footerAction, { borderColor: theme.hairline, marginTop: space.sm }]}
        >
          <Text style={[type.label, { color: theme.negative }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <Text style={[type.body, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[type.label, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Hint({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        type.caption,
        { color: theme.textFaint, paddingHorizontal: space.xl, marginTop: space.sm },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  accountDot: { width: 8, height: 8, borderRadius: 2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footerAction: {
    marginHorizontal: space.lg,
    marginTop: space.xxl,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
