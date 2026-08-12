import React, { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, space, type } from '../theme';
import { usePreferences, useTheme } from '../preferences';

type Props = {
  children: React.ReactNode;
  /** Invoked when the revealed action is tapped, or the row is dragged past the threshold. */
  onDelete: () => void;
  label?: string;
};

const ACTION_WIDTH = 96;

/**
 * Drag a row leftwards to reveal Delete. The action is deliberately not immediate:
 * releasing past the threshold, or tapping the panel, hands off to the confirmation
 * dialog rather than removing anything on the spot.
 */
export function SwipeableRow({ children, onDelete, label = 'Delete' }: Props) {
  const theme = useTheme();
  const { prefs } = usePreferences();
  const ref = useRef<SwipeableMethods>(null);
  // Guards against the drag-open and the button tap both firing.
  const fired = useRef(false);

  const trigger = () => {
    if (fired.current) return;
    fired.current = true;
    if (prefs.haptics && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    ref.current?.close();
    onDelete();
    // Released after the close animation, so the row can be swiped again.
    setTimeout(() => {
      fired.current = false;
    }, 400);
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={trigger}
      renderRightActions={(_progress, translation) => (
        <DeleteAction
          translation={translation}
          label={label}
          color={theme.negative}
          onPress={trigger}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function DeleteAction({
  translation,
  label,
  color,
  onPress,
}: {
  translation: SharedValue<number>;
  label: string;
  color: string;
  onPress: () => void;
}) {
  // Pinning the panel to the row's trailing edge keeps it from sliding in at half speed.
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.actionWrap, animated]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: color, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="trash-outline" size={19} color="#FFFFFF" />
        <Text style={[type.caption, { color: '#FFFFFF' }]}>{label.toUpperCase()}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actionWrap: { width: ACTION_WIDTH, paddingVertical: 4, paddingRight: space.md },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
  },
});
