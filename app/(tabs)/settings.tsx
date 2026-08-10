import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { useApp } from '../../src/store';
import { API_URL, api } from '../../src/api';
import { formatAmount } from '../../src/format';
import { radius, space, type, useTheme } from '../../src/theme';

export default function Settings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

  const removeAccount = (id: string, name: string) => {
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
  };

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

        <Section title="Account" />
        <Glass style={styles.card}>
          <View style={{ padding: space.lg, gap: 4 }}>
            <Text style={[type.body, { color: theme.text }]}>{user?.username ?? '—'}</Text>
            <Text style={[type.label, { color: theme.textFaint }]}>{user?.email ?? ''}</Text>
          </View>
        </Glass>

        <Section title="Accounts" />
        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.sm }}>
            {accounts.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? (
                  <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
                ) : null}
                <Pressable
                  onLongPress={() => removeAccount(a.id, a.accountName)}
                  style={styles.row}
                >
                  <Text style={[type.body, { color: theme.text, flex: 1 }]}>{a.accountName}</Text>
                  <Text style={[type.amount, { color: theme.textMuted }]}>
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
              <Pressable onPress={() => setAddingAccount(true)} style={styles.row}>
                <Ionicons name="add" size={18} color={theme.textMuted} />
                <Text style={[type.label, { color: theme.textMuted, marginLeft: space.sm }]}>
                  Add account
                </Text>
              </Pressable>
            )}
          </View>
        </Glass>
        <Hint text="Long-press an account to delete it." />

        <Section title="Data" />
        <Glass style={styles.card}>
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Stat label="Transactions" value={String(transactions.length)} />
            <Stat label="Categories" value={String(categories.length)} />
            <Stat label="Server" value={API_URL.replace(/^https?:\/\//, '')} />
          </View>
        </Glass>

        <Pressable
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={[styles.signOut, { borderColor: theme.hairline }]}
        >
          <Text style={[type.label, { color: theme.negative }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        type.caption,
        {
          color: theme.textFaint,
          textTransform: 'uppercase',
          paddingHorizontal: space.xl,
          marginTop: space.xl,
          marginBottom: space.md,
        },
      ]}
    >
      {title}
    </Text>
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
  card: { marginHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
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
  signOut: {
    marginHorizontal: space.lg,
    marginTop: space.xxl,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
