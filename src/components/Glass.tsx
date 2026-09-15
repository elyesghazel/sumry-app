import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { radius } from '../theme';
import { useTheme } from '../preferences';

type Props = ViewProps & {
  /** Kept for callers; both variants are the same flat panel now. */
  variant?: 'plain' | 'strong';
  radiusSize?: number;
};

/**
 * A panel: raised paper with a hairline. The name is historical — this used to be a
 * frosted surface. The ledger has no glass; things you can touch sit on a slightly
 * lighter sheet, everything else is ruled directly onto the page.
 */
export function Glass({ radiusSize = radius.lg, style, children, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: radiusSize,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.hairline,
          backgroundColor: theme.bgElevated,
          overflow: 'hidden',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
