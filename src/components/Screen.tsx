import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useTheme } from '../theme';

/**
 * The app's ground. A single very soft top-to-bottom gradient gives the glass surfaces
 * something to refract; without it frosted panels read as flat grey rectangles.
 */
export function Screen({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const scheme = useColorScheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={[theme.gradientTop, theme.gradientBottom]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
