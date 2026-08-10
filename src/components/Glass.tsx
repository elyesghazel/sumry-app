import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius } from '../theme';
import { useTheme } from '../theme';

type Props = ViewProps & {
  /** `strong` is reserved for surfaces that float above content, like the entry sheet. */
  variant?: 'plain' | 'strong';
  radiusSize?: number;
};

/**
 * A frosted surface — used sparingly. Blur is expensive and, applied everywhere, turns
 * into visual noise, so this wraps only the few surfaces that genuinely float: the
 * balance card, the tab bar and the amount sheet.
 *
 * Android's blur support is patchy across devices, so there it degrades to a flat tinted
 * panel that looks intentional rather than broken.
 */
export function Glass({ variant = 'plain', radiusSize = radius.lg, style, children, ...rest }: Props) {
  const theme = useTheme();

  const shell: ViewStyle = {
    borderRadius: radiusSize,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.hairline,
    overflow: 'hidden',
  };

  const fill = variant === 'strong' ? theme.glassStrong : theme.glass;

  if (Platform.OS === 'android') {
    return (
      <View style={[shell, { backgroundColor: theme.bgElevated }, style]} {...rest}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} pointerEvents="none" />
        {children}
      </View>
    );
  }

  return (
    <View style={[shell, style]} {...rest}>
      <BlurView
        intensity={variant === 'strong' ? 40 : 24}
        tint={theme.blurTint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} pointerEvents="none" />
      {children}
    </View>
  );
}
