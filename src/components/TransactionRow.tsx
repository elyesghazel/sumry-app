import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, Transaction } from '../api';
import { formatAmount, formatTime, isTransfer, signOf } from '../format';
import { categoryColor, radius, space, type } from '../theme';
import { usePreferences, useTheme } from '../preferences';
import { SwipeableRow } from './SwipeableRow';

type Props = {
  tx: Transaction;
  category?: Category;
  accountName?: string;
  /** Shown when the list mixes accounts, hidden when it is already scoped to one. */
  showAccount?: boolean;
  onPress?: () => void;
  /** When given, the row can be dragged left to reveal a delete action. */
  onDelete?: () => void;
};

export function TransactionRow({
  tx,
  category,
  accountName,
  showAccount,
  onPress,
  onDelete,
}: Props) {
  const theme = useTheme();
  const { mask } = usePreferences();
  const transfer = isTransfer(tx.kind);
  const sign = signOf(tx.kind);

  const title = transfer
    ? tx.kind === 'TRANSFER_OUT'
      ? 'Transfer out'
      : 'Transfer in'
    : (tx.categoryLabel ?? 'Uncategorised');

  const subtitle = [tx.description, showAccount ? accountName : null]
    .filter(Boolean)
    .join(' · ');

  const iconName = (transfer ? 'swap-horizontal' : (category?.icon ?? 'pricetag')) as never;
  const tint = transfer
    ? theme.textMuted
    : categoryColor(theme, tx.categoryLabel ?? '', category?.color);

  // Transfers are movements between your own accounts, not spending, so they stay
  // neutral. Everything else is coloured by direction.
  const amountColor = transfer ? theme.textMuted : sign > 0 ? theme.positive : theme.negative;

  const row = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { opacity: 0.6 } : null]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${sign > 0 ? 'plus' : 'minus'} ${formatAmount(tx.amount)}`}
    >
      <View style={[styles.icon, { backgroundColor: theme.keypad }]}>
        <Ionicons name={iconName} size={17} color={tint} />
      </View>

      <View style={styles.body}>
        <Text style={[type.body, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.label, { color: theme.textFaint, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        <Text style={[type.amount, { color: amountColor }]}>
          {sign > 0 ? '+' : '−'}
          {mask(formatAmount(tx.amount), 'all')}
        </Text>
        <Text style={[type.caption, { color: theme.textFaint, marginTop: 2 }]}>
          {formatTime(new Date(tx.date))}
        </Text>
      </View>
    </Pressable>
  );

  if (!onDelete) return row;
  return <SwipeableRow onDelete={onDelete}>{row}</SwipeableRow>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  trailing: { alignItems: 'flex-end' },
});
