import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Screen } from '../../src/components/Screen';
import { Divider, Group, LinkRow, SegmentRow, SwitchRow } from '../../src/components/Rows';
import { useApp } from '../../src/store';
import { API_URL, api } from '../../src/api';
import { TIMEFRAMES, usePreferences, useTheme } from '../../src/preferences';
import { useToast } from '../../src/components/Toast';
import { useConfirm, useDestructiveAction } from '../../src/components/ConfirmDialog';
import { formatAmount } from '../../src/format';
import { ThemeMode } from '../../src/theme';
import type { PrivacyMode } from '../../src/preferences';
import { radius, space, type } from '../../src/theme';

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, reset, mask } = usePreferences();
  const { user, accounts, categories, transactions, signOut, mutate, token } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const confirmDestructive = useDestructiveAction();

  const [addingAccount, setAddingAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  // Account currently being reconciled ("abgleichen"), and the real balance entered.
  // Whether this device can actually do it; the toggle is pointless otherwise.
  const [biometrics, setBiometrics] = useState<{ ok: boolean; label: string } | null>(null);

  React.useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync().catch(
        () => [] as LocalAuthentication.AuthenticationType[],
      );
      const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? 'Face unlock'
        : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
          ? 'Fingerprint'
          : 'Device unlock';
      setBiometrics({
        ok: hasHardware && enrolled,
        label: !hasHardware ? 'No biometric hardware' : !enrolled ? 'Nothing enrolled on this device' : label,
      });
    })();
  }, []);

  const [reconciling, setReconciling] = useState<string | null>(null);
  const [realBalance, setRealBalance] = useState('');
  const [busy, setBusy] = useState(false);

  const reconcile = async (id: string) => {
    const target = Number.parseFloat(realBalance.replace(',', '.'));
    if (!Number.isFinite(target)) return;
    setBusy(true);
    try {
      const account = accounts.find((a) => a.id === id);
      const diff = target - (account?.currentBalance ?? 0);
      await mutate((t) => api.reconcileAccount(t, id, target, 'Abgleich'));
      setReconciling(null);
      setRealBalance('');
      if (Math.abs(diff) < 0.005) {
        toast.show({
          message: 'Already up to date',
          description: 'The balance already matched — nothing was booked.',
        });
      } else {
        toast.success(
          'Account adjusted',
          `Booked ${diff > 0 ? '+' : '−'}${formatAmount(diff)} as an "Einstellung" entry.`,
        );
      }
    } catch (e) {
      toast.error('Could not adjust', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const addAccount = async () => {
    const name = accountName.trim();
    const balance = Number.parseFloat(openingBalance || '0');
    if (!name || !Number.isFinite(balance)) return;
    try {
      await mutate((t) => api.createAccount(t, name, balance));
      setAddingAccount(false);
      setAccountName('');
      setOpeningBalance('');
      toast.success('Account added', name);
    } catch (e) {
      toast.error('Could not add account', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const removeAccount = (id: string, name: string) =>
    void confirmDestructive(
      {
        title: 'Delete this account?',
        message: `${name} and every transaction on it will be removed. This cannot be undone.`,
      },
      () => mutate((t) => api.deleteAccount(t, id)),
      {
        onSuccess: () => toast.success('Account deleted', name),
        onError: (message) => toast.error('Could not delete', message),
      },
    );

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
          <SegmentRow<PrivacyMode>
            label="Hide amounts"
            value={prefs.privacy}
            onChange={(v) => set('privacy', v)}
            options={[
              { key: 'off', label: 'Off' },
              { key: 'balances', label: 'Balances' },
              { key: 'all', label: 'Everything' },
            ]}
          />
          <Divider />
          <SwitchRow
            icon="lock-closed-outline"
            label="App lock"
            hint={
              biometrics?.ok
                ? `Require ${biometrics.label.toLowerCase()} to open Sumry`
                : (biometrics?.label ?? 'Checking…')
            }
            value={prefs.appLock && (biometrics?.ok ?? false)}
            onChange={(v) => {
              if (!biometrics?.ok) {
                toast.show({
                  message: 'App lock is not available',
                  description:
                    'Set up a fingerprint, face unlock or a screen lock in your phone settings first.',
                  tone: 'error',
                });
                return;
              }
              set('appLock', v);
            }}
          />
          {prefs.appLock && biometrics?.ok ? (
            <>
              <Divider />
              <LinkRow
                icon="time-outline"
                label="Lock after"
                value={
                  prefs.lockDelaySeconds === 0
                    ? 'Immediately'
                    : prefs.lockDelaySeconds >= 60
                      ? `${Math.round(prefs.lockDelaySeconds / 60)} min`
                      : `${prefs.lockDelaySeconds}s`
                }
                onPress={() => {
                  const steps = [0, 15, 60, 300, 900];
                  const i = steps.indexOf(prefs.lockDelaySeconds);
                  set('lockDelaySeconds', steps[(i + 1) % steps.length]);
                }}
              />
            </>
          ) : null}
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
              <Pressable
                onPress={() => {
                  setReconciling(reconciling === a.id ? null : a.id);
                  setRealBalance(
                    reconciling === a.id ? '' : String((a.currentBalance ?? 0).toFixed(2)),
                  );
                }}
                onLongPress={() => removeAccount(a.id, a.accountName)}
                style={styles.row}
              >
                <View
                  style={[
                    styles.accountDot,
                    { backgroundColor: theme.categorical[i % theme.categorical.length] },
                  ]}
                />
                <Text style={[type.body, { color: theme.text, flex: 1 }]}>{a.accountName}</Text>
                <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>
                  {mask(formatAmount(a.currentBalance ?? 0))}
                </Text>
                <Ionicons
                  name={reconciling === a.id ? 'chevron-up' : 'swap-vertical-outline'}
                  size={16}
                  color={theme.textFaint}
                />
              </Pressable>

              {reconciling === a.id ? (
                <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
                  <Text style={[type.caption, { color: theme.textFaint }]}>
                    Real balance — the difference is booked as an "Einstellung" entry
                  </Text>
                  <TextInput
                    value={realBalance}
                    onChangeText={setRealBalance}
                    placeholder="e.g. 128.40"
                    placeholderTextColor={theme.textFaint}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.keypad,
                        borderColor: theme.hairline,
                      },
                    ]}
                  />
                  {Number.isFinite(Number.parseFloat(realBalance.replace(',', '.'))) ? (
                    <Text style={[type.label, { color: theme.textMuted }]}>
                      Adjustment:{' '}
                      {(() => {
                        const d =
                          Number.parseFloat(realBalance.replace(',', '.')) -
                          (a.currentBalance ?? 0);
                        return `${d >= 0 ? '+' : '−'}${formatAmount(d)}`;
                      })()}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Pressable
                      onPress={() => setReconciling(null)}
                      style={[styles.action, { borderColor: theme.hairline }]}
                    >
                      <Text style={[type.label, { color: theme.textMuted }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => reconcile(a.id)}
                      disabled={busy}
                      style={[
                        styles.action,
                        { backgroundColor: theme.text, borderColor: theme.text, opacity: busy ? 0.4 : 1 },
                      ]}
                    >
                      <Text style={[type.label, { color: theme.bg }]}>Adjust</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
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

        <Group title="Plan">
          <LinkRow
            icon="calendar-outline"
            label="Planned & goals"
            onPress={() => router.push('/plan')}
          />
          <Divider />
          <LinkRow
            icon="pie-chart-outline"
            label="Budgets"
            onPress={() => router.push('/budgets')}
          />
        </Group>

        {/* The token goes out through the share sheet: copy it, or AirDrop it to the Mac. */}
        <Group title="Apple Pay shortcut">
          <LinkRow
            icon="logo-apple"
            label="Create shortcut token"
            value="valid 1 year"
            onPress={async () => {
              if (!token) return;
              try {
                const res = await api.shortcutToken(token);
                await Share.share({ message: res.token });
              } catch (e) {
                toast.error('Could not create token', e instanceof Error ? e.message : 'Unknown error');
              }
            }}
          />
        </Group>
        <Hint text="For the Wallet automation that logs Apple Pay payments. The token can only log entries and list categories; “Sign out everywhere” revokes it." />

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
            void confirmDestructive(
              {
                title: 'Reset preferences?',
                message: 'Appearance, privacy and defaults go back to stock. Your data is not affected.',
                confirmLabel: 'Reset',
                icon: 'refresh-outline',
              },
              async () => reset(),
              { onSuccess: () => toast.success('Preferences reset') },
            )
          }
          style={[styles.footerAction, { borderColor: theme.hairline }]}
        >
          <Text style={[type.label, { color: theme.textMuted }]}>Reset preferences</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            const ok = await confirm({
              title: 'Sign out?',
              message: `You will need your password to get back into ${user?.email ?? 'Sumry'}.`,
              confirmLabel: 'Sign out',
              destructive: true,
              icon: 'log-out-outline',
            });
            if (ok) void signOut();
          }}
          style={[styles.footerAction, { borderColor: theme.hairline, marginTop: space.sm }]}
        >
          <Text style={[type.label, { color: theme.negative }]}>Sign out</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            const ok = await confirm({
              title: 'Sign out everywhere?',
              message: 'Every device — this one, the web, anything else — has to sign in again.',
              confirmLabel: 'Sign out everywhere',
              destructive: true,
              icon: 'log-out-outline',
            });
            if (ok) void signOut(true);
          }}
          style={[styles.footerAction, { borderColor: theme.hairline, marginTop: space.sm }]}
        >
          <Text style={[type.label, { color: theme.textMuted }]}>Sign out everywhere</Text>
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
