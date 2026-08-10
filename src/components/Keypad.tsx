import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '../theme';
import { usePreferences, useTheme } from '../preferences';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/**
 * A purpose-built number pad rather than the OS keyboard.
 *
 * Amounts are the only thing typed on the entry screen, and the system keyboard costs an
 * animation, hides half the screen and puts the digits in the wrong place. Big fixed keys
 * make logging an expense a two-second job one-handed.
 */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  const theme = useTheme();
  const { tick } = usePreferences();

  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => {
            tick();
            onKey(key);
          }}
          accessibilityRole="button"
          accessibilityLabel={key === 'del' ? 'Delete last digit' : key}
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: pressed ? theme.keypad : 'transparent' },
          ]}
        >
          {key === 'del' ? (
            <Ionicons name="backspace-outline" size={22} color={theme.textMuted} />
          ) : (
            <Text style={[styles.keyText, { color: theme.text }]}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** Appends a keystroke to an amount string, keeping it a valid 2-decimal number. */
export function applyKey(current: string, key: string): string {
  if (key === 'del') return current.length <= 1 ? '0' : current.slice(0, -1);

  if (key === '.') return current.includes('.') ? current : `${current}.`;

  // Two decimal places is as fine-grained as money gets here.
  const [, decimals] = current.split('.');
  if (decimals !== undefined && decimals.length >= 2) return current;

  if (current === '0') return key;
  return current + key;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  key: {
    width: '33.333%',
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  keyText: { fontSize: 24, fontWeight: '400', fontVariant: ['tabular-nums'] },
});
