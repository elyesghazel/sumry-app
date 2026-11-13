import type { ComponentProps, ComponentRef } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { font } from '../theme';

/** React Native's TextInput with JetBrains Mono as the default face, so fields match the eg. type. */
export function TextInput({ style, ...rest }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput style={[{ fontFamily: font.regular }, style]} {...rest} />;
}
export type TextInput = ComponentRef<typeof RNTextInput>;
