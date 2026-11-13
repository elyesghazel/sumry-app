import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '../src/components/TextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../src/components/Screen';
import { Glass } from '../src/components/Glass';
import { useApp } from '../src/store';
import { radius, space, type } from '../src/theme';
import { useTheme } from '../src/preferences';

export default function SignIn() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, register } = useApp();

  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'sign-in') await signIn(email, password);
      else await register(username, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (mode === 'sign-in' || username.trim().length > 0);

  const field = [styles.input, { color: theme.text, borderColor: theme.hairline }];

  return (
    <Screen>
      {/* `height` on Android and `padding` on iOS is the combination that actually
          shrinks the scroll area rather than sliding it under the keyboard. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          // Keeps the focused field in view instead of letting the keyboard cover it.
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.brand}>
            <Text style={[type.display, { color: theme.text }]}>
              sumry<Text style={{ color: theme.accent }}>.</Text>
            </Text>
            <Text style={[type.body, { color: theme.textMuted, marginTop: space.xs }]}>
              See your money. Understand it.
            </Text>
          </View>

          <Glass style={styles.card}>
            <View style={styles.cardInner}>
              {mode === 'register' ? (
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  placeholderTextColor={theme.textFaint}
                  autoCapitalize="none"
                  style={field}
                />
              ) : null}

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={theme.textFaint}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={field}
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.textFaint}
                secureTextEntry
                style={field}
                onSubmitEditing={canSubmit && !busy ? submit : undefined}
                returnKeyType="go"
              />

              {error ? (
                <Text style={[type.label, { color: theme.negative }]}>{error}</Text>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={!canSubmit || busy}
                style={({ pressed }) => [
                  styles.submit,
                  {
                    backgroundColor: theme.text,
                    opacity: !canSubmit || busy ? 0.35 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={theme.bg} />
                ) : (
                  <Text style={[type.label, { color: theme.bg, fontSize: 15 }]}>
                    {mode === 'sign-in' ? 'Sign in' : 'Create account'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  setMode(mode === 'sign-in' ? 'register' : 'sign-in');
                  setError(null);
                }}
                hitSlop={8}
              >
                <Text style={[type.label, { color: theme.textMuted, textAlign: 'center' }]}>
                  {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
                </Text>
              </Pressable>
            </View>
          </Glass>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  brand: { marginBottom: space.xxl },
  card: {},
  cardInner: { padding: space.xl, gap: space.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    fontSize: 16,
  },
  submit: {
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    alignItems: 'center',
    marginTop: space.xs,
  },
});
