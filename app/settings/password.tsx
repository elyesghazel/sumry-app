import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { useApp } from '../../src/store';
import { api } from '../../src/api';
import { useTheme } from '../../src/preferences';
import { radius, space, type } from '../../src/theme';

const MIN_LENGTH = 8;

export default function ChangePassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useApp();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !busy;

  const submit = async () => {
    if (!canSubmit || !token) return;
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(token, current, next);
      // The existing token stays valid, so there is nothing to re-authenticate.
      Alert.alert('Password changed', 'Use your new password next time you sign in.');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  };

  const field = {
    color: theme.text,
    backgroundColor: theme.keypad,
    borderColor: theme.hairline,
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.label, { color: theme.textMuted }]}>Change password</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Glass>
            <View style={{ padding: space.lg, gap: space.md }}>
              <TextInput
                value={current}
                onChangeText={setCurrent}
                placeholder="Current password"
                placeholderTextColor={theme.textFaint}
                secureTextEntry
                autoCapitalize="none"
                style={[styles.input, field]}
              />
              <TextInput
                value={next}
                onChangeText={setNext}
                placeholder={`New password (min ${MIN_LENGTH})`}
                placeholderTextColor={theme.textFaint}
                secureTextEntry
                autoCapitalize="none"
                style={[styles.input, field]}
              />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat new password"
                placeholderTextColor={theme.textFaint}
                secureTextEntry
                autoCapitalize="none"
                style={[
                  styles.input,
                  field,
                  mismatch ? { borderColor: theme.negative } : null,
                ]}
                onSubmitEditing={canSubmit ? submit : undefined}
                returnKeyType="go"
              />

              {tooShort ? (
                <Text style={[type.caption, { color: theme.textFaint }]}>
                  At least {MIN_LENGTH} characters.
                </Text>
              ) : null}
              {mismatch ? (
                <Text style={[type.caption, { color: theme.negative }]}>
                  The two new passwords do not match.
                </Text>
              ) : null}
              {error ? (
                <Text style={[type.label, { color: theme.negative }]}>{error}</Text>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.save,
                  {
                    backgroundColor: theme.text,
                    opacity: !canSubmit ? 0.3 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={theme.bg} />
                ) : (
                  <Text style={[type.label, { color: theme.bg, fontSize: 15 }]}>
                    Change password
                  </Text>
                )}
              </Pressable>
            </View>
          </Glass>

          <Text
            style={[type.caption, { color: theme.textFaint, marginTop: space.lg, lineHeight: 16 }]}
          >
            Your current password is required even though you are signed in, so a borrowed
            device or token cannot be used to lock you out of your own account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md + 2,
    fontSize: 16,
  },
  save: {
    borderRadius: radius.md,
    paddingVertical: space.md + 4,
    alignItems: 'center',
    marginTop: space.xs,
  },
});
