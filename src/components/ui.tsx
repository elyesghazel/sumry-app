import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Glass } from './Glass';
import { usePreferences, useTheme } from '../preferences';
import { radius, space, type } from '../theme';

/**
 * The small pieces every screen of the redesign repeats: a back header, section captions,
 * cards, chips, pill buttons and meters. All of them stay on the ledger tokens in theme.ts.
 */

/** Back chevron, a title and an optional trailing control. */
export function Header({
  title,
  right,
  close,
  subtitle,
}: {
  title: string;
  right?: React.ReactNode;
  /** A close cross instead of the back chevron, for modals. */
  close?: boolean;
  subtitle?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name={close ? 'close' : 'chevron-back'} size={24} color={theme.textMuted} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={[type.title, { color: theme.text, fontSize: 22 }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.caption, { color: theme.textFaint, letterSpacing: 0.2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ minWidth: 24, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Uppercase caption above a card, with an optional detail and a text action. */
export function Section({
  title,
  detail,
  detailColor,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  detailColor?: string;
  action?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  const { tick } = usePreferences();
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Text style={[type.caption, { color: theme.textFaint, textTransform: 'uppercase' }]}>{title}</Text>
        {detail ? (
          <Text style={[type.caption, { color: detailColor ?? theme.textMuted, letterSpacing: 0.2 }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={() => {
            tick();
            onAction?.();
          }}
          hitSlop={8}
        >
          <Text style={[type.label, { color: theme.accent }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <Glass style={[styles.card, style]}>
      <View style={padded ? styles.cardInner : { paddingVertical: space.xs }}>{children}</View>
    </Glass>
  );
}

export function Divider({ inset = space.lg }: { inset?: number }) {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.hairline, marginLeft: inset }} />;
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: string;
}) {
  const theme = useTheme();
  const { tick } = usePreferences();
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.text : theme.keypad,
          borderColor: active ? theme.text : theme.hairline,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon ? <Ionicons name={icon as never} size={13} color={active ? theme.bg : theme.textMuted} /> : null}
      <Text style={[type.label, { color: active ? theme.bg : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

/** Pill button. `primary` is ink on paper, the rest outlined. */
export function Btn({
  label,
  onPress,
  primary,
  danger,
  icon,
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  icon?: string;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { tick } = usePreferences();
  const fg = primary ? theme.bg : danger ? theme.negative : theme.text;
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        tick();
        onPress();
      }}
      hitSlop={small ? 6 : 2}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        small ? styles.btnSmall : styles.btn,
        {
          backgroundColor: primary ? theme.text : theme.bg,
          borderColor: primary ? theme.text : danger ? theme.negative : theme.hairlineStrong,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon as never} size={small ? 12 : 15} color={fg} /> : null}
      <Text style={[small ? styles.btnSmallText : type.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A thin progress meter. Tone picks the fill: ok ink/green, warn accent, over red. */
export function Meter({
  ratio,
  tone = 'ink',
  height = 6,
  style,
}: {
  ratio: number;
  tone?: 'ink' | 'ok' | 'warn' | 'over';
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const fill =
    tone === 'over' ? theme.negative : tone === 'warn' ? theme.accent : tone === 'ok' ? theme.positive : theme.text;
  const pct = Math.max(ratio > 0 ? 2 : 0, Math.min(100, ratio * 100));
  return (
    <View style={[{ height, borderRadius: radius.pill, backgroundColor: theme.keypad, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: radius.pill, backgroundColor: fill }} />
    </View>
  );
}

/** Label on the left, a figure on the right. */
export function KV({
  label,
  value,
  strong,
  color,
  onPress,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const body = (
    <View style={styles.kv}>
      <Text style={[strong ? type.label : type.body, { color: strong ? theme.text : theme.textMuted, flex: 1 }]}>
        {label}
      </Text>
      <Text style={[type.amount, { color: color ?? theme.text, fontSize: strong ? 19 : 15 }]}>{value}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={13} color={theme.textFaint} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Empty({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[type.label, { color: theme.textFaint, padding: space.lg }]}>{text}</Text>;
}

export function Hint({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text style={[type.caption, { color: theme.textFaint, paddingHorizontal: space.xl, marginTop: space.sm, letterSpacing: 0.2 }]}>
      {text}
    </Text>
  );
}

export function Field(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textFaint}
      {...props}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.keypad, borderColor: theme.hairline },
        props.style,
      ]}
    />
  );
}

/** Wrapping single-choice pills. */
export function Pills({
  items,
  selected,
  onSelect,
}: {
  items: { key: string; label: string }[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {items.map((it) => (
        <Chip key={it.key} label={it.label} active={selected === it.key} onPress={() => onSelect(it.key)} />
      ))}
    </View>
  );
}

/** Segmented control. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  const { tick } = usePreferences();
  return (
    <View style={[styles.segment, { backgroundColor: theme.keypad }]}>
      {options.map(([k, l]) => (
        <Pressable
          key={k}
          onPress={() => {
            tick();
            onChange(k);
          }}
          style={[styles.segmentItem, value === k ? { backgroundColor: theme.bgElevated } : null]}
        >
          <Text style={[type.label, { color: value === k ? theme.text : theme.textFaint }]}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A small coloured square that names a category. */
export function Swatch({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: 2, backgroundColor: color }} />;
}

export const ui = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chipsRow: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.sm },
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flex: 1 },
  card: { marginHorizontal: space.lg },
  cardInner: { padding: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnSmallText: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold' },
  kv: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
});
