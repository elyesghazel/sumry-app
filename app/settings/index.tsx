import React, { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../../src/components/TextInput';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Screen } from '../../src/components/Screen';
import { Divider, Group, LinkRow, SegmentRow, SwitchRow } from '../../src/components/Rows';
import { useApp } from '../../src/store';
import { formatAmount, type ShortcutToken } from '../../src/core';
import * as Clipboard from 'expo-clipboard';
import { Btn, Header } from '../../src/components/ui';
import { shareTextFile } from '../../src/lib/files';
import { shortDay } from '../../src/lib/dates';
import { api } from '../../src/api';
import { TIMEFRAMES, usePreferences, useTheme } from '../../src/preferences';
import { useToast } from '../../src/components/Toast';
import { useConfirm, useDestructiveAction } from '../../src/components/ConfirmDialog';
import { ThemeMode } from '../../src/theme';
import type { PrivacyMode } from '../../src/preferences';
import { radius, space, type } from '../../src/theme';

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, reset, mask } = usePreferences();
  const { user, accounts, categories, transactions, budgets, rules, signOut, token, server, mutate } = useApp();
  const [shortcut, setShortcut] = useState<ShortcutToken | null>(null);

  const exportAs = async (kind: 'csv' | 'json') => {
    if (!token) return;
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'csv') await shareTextFile(`sumry-${stamp}.csv`, await api.exportCsv(token), 'text/csv');
      else await shareTextFile(`sumry-${stamp}.json`, JSON.stringify(await api.exportJson(token), null, 2), 'application/json');
    } catch (e) {
      toast.error('Could not export', e instanceof Error ? e.message : 'Unknown error');
    }
  };
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

  const defaultAccountName =
    accounts.find((a) => a.id === prefs.defaultAccountId)?.accountName ?? 'First account';

  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom + 96,
        }}
      >

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
              <Pressable onPress={() => router.push(`/account/${a.id}`)} style={styles.row}>
                <View style={[styles.accountDot, { backgroundColor: a.spending !== false ? theme.text : theme.textFaint }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: theme.text }]}>{a.accountName}</Text>
                  <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]}>
                    {a.spending === false ? 'savings' : 'spending'} · {a.lastReconciledAt ? `checked ${shortDay(a.lastReconciledAt)}` : a.lastReconciledAt === null ? 'never checked' : a.currency}
                  </Text>
                </View>
                <Text style={[type.amount, { color: theme.textMuted, fontSize: 15 }]}>{mask(formatAmount(a.currentBalance ?? 0))}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
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
        <Hint text="Tap an account to check it against the bank, rename it, delete it or take it out of safe to spend." />

        <Group title="Data">
          <LinkRow icon="cloud-upload-outline" label="Import statement" value="PDF, XML, CSV" onPress={() => router.push('/import')} />
          <Divider />
          <LinkRow icon="document-outline" label="Export CSV" value={`${transactions.length} entries`} onPress={() => void exportAs('csv')} />
          <Divider />
          <LinkRow icon="code-slash-outline" label="Export JSON" onPress={() => void exportAs('json')} />
          <Divider />
          <LinkRow icon="document-text-outline" label="Monthly statement" onPress={() => router.push('/statement')} />
          <Divider />
          <LinkRow icon="pie-chart-outline" label="Budgets" value={`${budgets.length}`} onPress={() => router.push('/budgets')} />
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
                setShortcut(res);
                await Clipboard.setStringAsync(res.token);
                toast.success('Token copied', `Valid until ${shortDay(res.expiresAt)}. Paste it into the Shortcut.`);
              } catch (e) {
                toast.error('Could not create token', e instanceof Error ? e.message : 'Unknown error');
              }
            }}
          />
        </Group>
        {shortcut ? (
          <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, marginTop: space.sm }}>
            <Btn small icon="copy-outline" label="Copy again" onPress={() => void Clipboard.setStringAsync(shortcut.token).then(() => toast.success('Copied'))} />
            <Btn small icon="share-outline" label="Share" onPress={() => void Share.share({ message: shortcut.token })} />
            <Btn small icon="server-outline" label="Copy server" onPress={() => void Clipboard.setStringAsync(server).then(() => toast.success('Server copied', server))} />
          </View>
        ) : null}
        <Hint text={`For the Wallet automation that logs Apple Pay payments. The Shortcut posts to ${server}. The token can only log entries and list categories; “Sign out everywhere” revokes it.`} />

        <Group title="Organise">
          <LinkRow
            icon="pricetags-outline"
            label="Categories and rules"
            value={`${categories.length} · ${rules.length} rules`}
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

        <Group title="Activity list">
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

        <Group title="About">
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Stat label="Transactions" value={String(transactions.length)} />
            <Stat label="Categories" value={String(categories.length)} />
            <Stat label="Accounts" value={String(accounts.length)} />
            <Stat label="Server" value={server.replace(/^https?:\/\//, '')} />
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
