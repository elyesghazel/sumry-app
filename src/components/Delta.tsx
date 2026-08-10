import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatAmount } from '../format';
import { type } from '../theme';
import { useTheme } from '../preferences';

/**
 * A signed change with a direction arrow.
 *
 * The arrow is the point: it states direction without the reader having to parse a minus
 * sign, and it means the colour is never the only thing carrying the meaning.
 */
export function Delta({
  value,
  suffix,
  size = 'md',
  /** For costs, where a rise is bad news; flips which direction reads as positive. */
  invert = false,
}: {
  value: number;
  suffix?: string;
  size?: 'sm' | 'md';
  invert?: boolean;
}) {
  const theme = useTheme();

  const flat = Math.abs(value) < 0.005;
  const up = value > 0;
  const good = invert ? !up : up;

  const color = flat ? theme.textFaint : good ? theme.positive : theme.negative;
  const iconSize = size === 'sm' ? 11 : 13;
  const textStyle = size === 'sm' ? type.caption : type.label;

  return (
    <View style={styles.row}>
      <Ionicons
        name={flat ? 'remove' : up ? 'arrow-up' : 'arrow-down'}
        size={iconSize}
        color={color}
      />
      <Text style={[textStyle, { color }]}>
        {formatAmount(value)}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}

/** Same idea for a percentage; renders nothing meaningful when there is no baseline. */
export function DeltaPercent({ value, invert = false }: { value: number | null; invert?: boolean }) {
  const theme = useTheme();
  if (value === null) {
    return <Text style={[type.caption, { color: theme.textFaint }]}>new</Text>;
  }

  const flat = Math.abs(value) < 0.5;
  const up = value > 0;
  const good = invert ? !up : up;
  const color = flat ? theme.textFaint : good ? theme.positive : theme.negative;

  return (
    <View style={styles.row}>
      <Ionicons name={flat ? 'remove' : up ? 'arrow-up' : 'arrow-down'} size={11} color={color} />
      <Text style={[type.caption, { color }]}>{Math.abs(Math.round(value))}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
