import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Glass } from './Glass';
import { useTheme } from '../preferences';
import { radius, space, type } from '../theme';

/** A grouped settings block with a heading. */
export function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <>
      {title ? (
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
      ) : null}
      <Glass style={styles.card}>
        <View style={{ paddingVertical: space.xs }}>{children}</View>
      </Glass>
    </>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.hairline }]} />;
}

/** A tappable row that leads somewhere, optionally showing its current value. */
export function LinkRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon?: string;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  const color = danger ? theme.negative : theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.6 } : null]}
      accessibilityRole="button"
    >
      {icon ? <Ionicons name={icon as never} size={18} color={theme.textMuted} /> : null}
      <Text style={[type.body, { color, flex: 1 }]}>{label}</Text>
      {value ? (
        <Text style={[type.label, { color: theme.textFaint }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
    </Pressable>
  );
}

export function SwitchRow({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon?: string;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon as never} size={18} color={theme.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: theme.text }]}>{label}</Text>
        {hint ? (
          <Text style={[type.caption, { color: theme.textFaint, marginTop: 2 }]}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.keypad }}
        thumbColor={theme.bgElevated}
      />
    </View>
  );
}

/** A row of mutually exclusive options — used for short choice lists like the theme. */
export function SegmentRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', gap: space.sm }]}>
      <Text style={[type.body, { color: theme.text }]}>{label}</Text>
      <View style={[styles.segment, { backgroundColor: theme.keypad }]}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segmentItem,
              value === o.key ? { backgroundColor: theme.bgElevated } : null,
            ]}
          >
            <Text
              style={[type.label, { color: value === o.key ? theme.text : theme.textFaint }]}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
});
