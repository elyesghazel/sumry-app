import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type } from '../theme';
import { useTheme } from '../preferences';

type Props = {
  /** The headline under the mark, e.g. the amount that was just logged. */
  title: string;
  subtitle?: string;
  tone?: 'positive' | 'neutral';
  /** Fired once the animation has played out, so the caller can navigate away. */
  onDone?: () => void;
  /** Milliseconds the mark holds before `onDone`. */
  hold?: number;
};

const RING = 116;

/**
 * The moment a transaction lands. A ring pulses outwards, the disc springs in and the
 * tick snaps on top — short enough that it never stands between you and the next entry,
 * but long enough to register as "saved" without reading anything.
 */
export function SuccessBurst({ title, subtitle, tone = 'positive', onDone, hold = 900 }: Props) {
  const theme = useTheme();
  const accent = tone === 'positive' ? theme.positive : theme.text;

  const veil = useSharedValue(0);
  const disc = useSharedValue(0);
  const ring = useSharedValue(0);
  const tick = useSharedValue(0);
  const text = useSharedValue(0);

  useEffect(() => {
    veil.value = withTiming(1, { duration: 160 });
    disc.value = withSpring(1, { damping: 11, stiffness: 190, mass: 0.6 });
    ring.value = withSequence(
      withTiming(0, { duration: 60 }),
      withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }),
    );
    tick.value = withDelay(140, withSpring(1, { damping: 12, stiffness: 260, mass: 0.5 }));
    text.value = withDelay(220, withTiming(1, { duration: 260 }));

    if (!onDone) return;
    const finish = setTimeout(() => {
      veil.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, hold);
    return () => clearTimeout(finish);
  }, [disc, hold, onDone, ring, text, tick, veil]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const discStyle = useAnimatedStyle(() => ({
    opacity: disc.value,
    transform: [{ scale: 0.4 + disc.value * 0.6 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 0.7 + ring.value * 0.75 }],
  }));
  const tickStyle = useAnimatedStyle(() => ({
    opacity: tick.value,
    transform: [{ scale: 0.5 + tick.value * 0.5 }, { rotate: `${(1 - tick.value) * -25}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: text.value,
    transform: [{ translateY: (1 - text.value) * 10 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.bg }, veilStyle]}
      pointerEvents="auto"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}`}
    >
      <View style={styles.mark}>
        <Animated.View style={[styles.ring, { borderColor: accent }, ringStyle]} />
        <Animated.View style={[styles.disc, { backgroundColor: accent }, discStyle]}>
          <Animated.View style={tickStyle}>
            <Ionicons name="checkmark" size={40} color={theme.bg} />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.caption, textStyle]}>
        <Text style={[type.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[type.body, { color: theme.textFaint, marginTop: space.xs }]}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  mark: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  disc: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { alignItems: 'center', marginTop: space.xl },
});
