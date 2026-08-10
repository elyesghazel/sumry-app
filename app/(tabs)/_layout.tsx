import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { radius, space, useTheme } from '../../src/theme';

/**
 * Four tabs and one action. The action sits in the middle of the bar because logging a
 * expense is the thing this app is for — it should never be more than one thumb-reach away.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const barHeight = 56 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.text,
          tabBarInactiveTintColor: theme.textFaint,
          tabBarShowLabel: false,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: {
            position: 'absolute',
            height: barHeight,
            paddingBottom: insets.bottom,
            backgroundColor:
              Platform.OS === 'android' ? theme.bgElevated : 'transparent',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.hairline,
            elevation: 0,
          },
          tabBarBackground:
            Platform.OS === 'ios'
              ? () => (
                  <BlurView
                    intensity={40}
                    tint={theme.blurTint}
                    style={StyleSheet.absoluteFill}
                  />
                )
              : undefined,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
            tabBarAccessibilityLabel: 'Overview',
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'list' : 'list-outline'} size={23} color={color} />
            ),
            tabBarAccessibilityLabel: 'Transactions',
          }}
        />
        {/* Spacer so the floating action button has a slot of its own. */}
        <Tabs.Screen
          name="placeholder"
          options={{ tabBarButton: () => <View style={{ flex: 1 }} /> }}
        />
        <Tabs.Screen
          name="budgets"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'pie-chart' : 'pie-chart-outline'}
                size={21}
                color={color}
              />
            ),
            tabBarAccessibilityLabel: 'Budgets',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={21}
                color={color}
              />
            ),
            tabBarAccessibilityLabel: 'Settings',
          }}
        />
      </Tabs>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/entry');
        }}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: insets.bottom + 12,
            backgroundColor: theme.text,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Ionicons name="add" size={28} color={theme.bg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
