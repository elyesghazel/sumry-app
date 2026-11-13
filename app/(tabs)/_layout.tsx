import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '../../src/theme';
import { usePreferences, useTheme } from '../../src/preferences';

const tab = (title: string, on: string, off: string) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, focused }: { color: unknown; focused: boolean }) => (
    <Ionicons name={(focused ? on : off) as never} size={21} color={color as string} />
  ),
});

/**
 * Today, Activity, Plan, Insights and one action. Long-press the action for a transfer. The action sits in the middle of the bar because logging a
 * expense is the thing this app is for — it should never be more than one thumb-reach away.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { tick } = usePreferences();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const barHeight = 60 + insets.bottom;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.text,
          tabBarInactiveTintColor: theme.textFaint,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 10 },
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarStyle: {
            position: 'absolute',
            height: barHeight,
            paddingBottom: insets.bottom,
            backgroundColor: theme.bgElevated,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.hairline,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen name="index" options={tab('Today', 'home', 'home-outline')} />
        <Tabs.Screen name="activity" options={tab('Activity', 'list', 'list-outline')} />
        {/* Spacer so the floating action button has a slot of its own. */}
        <Tabs.Screen name="placeholder" options={{ tabBarButton: () => <View style={{ flex: 1 }} /> }} />
        <Tabs.Screen name="plan" options={tab('Plan', 'calendar', 'calendar-outline')} />
        <Tabs.Screen name="insights" options={tab('Insights', 'stats-chart', 'stats-chart-outline')} />
      </Tabs>

      <Pressable
        onPress={() => {
          tick();
          router.push('/entry');
        }}
        onLongPress={() => {
          tick();
          router.push({ pathname: '/entry', params: { mode: 'TRANSFER' } });
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
        <Ionicons name="add" size={28} color={theme.bgElevated} />
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
