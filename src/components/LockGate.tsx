import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from './Screen';
import { usePreferences, useTheme } from '../preferences';
import { radius, space, type } from '../theme';

/**
 * Requires the device unlock — Face ID, fingerprint or the device passcode — before the
 * app is usable.
 *
 * Be clear about what this is: a gate in front of the UI. The biometric never reaches
 * the app; the OS only answers "yes, it's them". It stops someone picking up your
 * unlocked phone and reading your finances. It is not encryption, and it does not
 * protect the stored token from someone with the device and the skills to read app
 * storage.
 *
 * The passcode is deliberately allowed as a fallback (`disableDeviceFallback: false`):
 * a wet or unrecognised finger must never leave you locked out of your own data.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { prefs } = usePreferences();

  const [supported, setSupported] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [failed, setFailed] = useState(false);

  // When the app was last backgrounded, to decide whether the grace period has passed.
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
      setSupported(hasHardware && enrolled);
    })();
  }, []);

  const authenticate = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    setFailed(false);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Sumry',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setUnlocked(true);
        leftAt.current = null;
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setPrompting(false);
    }
  }, [prompting]);

  const active = prefs.appLock && supported === true;

  // Prompt as soon as the lock becomes relevant.
  useEffect(() => {
    if (active && !unlocked && !prompting) void authenticate();
    // authenticate is intentionally omitted: including it re-fires the prompt on every
    // state change it makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, unlocked]);

  // Re-lock after the app has been away longer than the grace period.
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const away = leftAt.current === null ? 0 : (Date.now() - leftAt.current) / 1000;
        if (away >= prefs.lockDelaySeconds) setUnlocked(false);
        leftAt.current = null;
      } else {
        leftAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [active, prefs.lockDelaySeconds]);

  // Not locked, unsupported hardware, or already unlocked: get out of the way.
  if (!active || unlocked) return <>{children}</>;

  return (
    <Screen>
      <View style={styles.root}>
        <View style={[styles.badge, { backgroundColor: theme.keypad }]}>
          <Ionicons name="lock-closed-outline" size={30} color={theme.textMuted} />
        </View>

        <Text style={[type.title, { color: theme.text, marginTop: space.xl }]}>
              sumry<Text style={{ color: theme.accent }}>.</Text>
            </Text>
        <Text
          style={[type.body, { color: theme.textMuted, marginTop: space.xs, textAlign: 'center' }]}
        >
          {failed ? 'Unlock cancelled' : 'Locked'}
        </Text>

        <Pressable
          onPress={authenticate}
          disabled={prompting}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.text, opacity: prompting ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[type.label, { color: theme.bg, fontSize: 15 }]}>
            {prompting ? 'Waiting…' : 'Unlock'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginTop: space.xxl,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md + 2,
    borderRadius: radius.md,
    minWidth: 180,
    alignItems: 'center',
  },
});
