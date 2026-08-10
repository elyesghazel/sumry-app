import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Glass } from '../../src/components/Glass';
import { INSIGHT_CARDS, InsightCard, usePreferences, useTheme } from '../../src/preferences';
import { radius, space, type } from '../../src/theme';

/** Chooses which analytics cards appear, and in what order. */
export default function InsightSettings() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { prefs, set, tick } = usePreferences();

  const enabled = prefs.cards;

  const toggle = (key: InsightCard) => {
    tick();
    set(
      'cards',
      enabled.includes(key)
        ? enabled.filter((k) => k !== key)
        // Re-inserting keeps the canonical order rather than appending to the end.
        : (INSIGHT_CARDS.map((c) => c.key).filter(
            (k) => k === key || enabled.includes(k),
          ) as InsightCard[]),
    );
  };

  const move = (key: InsightCard, direction: -1 | 1) => {
    const i = enabled.indexOf(key);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= enabled.length) return;
    const next = [...enabled];
    [next[i], next[j]] = [next[j], next[i]];
    tick();
    set('cards', next);
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={theme.textMuted} />
        </Pressable>
        <Text style={[type.title, { color: theme.text }]}>Insight cards</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <Text
          style={[
            type.caption,
            {
              color: theme.textFaint,
              textTransform: 'uppercase',
              paddingHorizontal: space.xl,
              marginTop: space.lg,
              marginBottom: space.md,
            },
          ]}
        >
          Shown · in this order
        </Text>

        <Glass style={styles.card}>
          <View style={{ paddingVertical: space.xs }}>
            {enabled.map((key, i) => {
              const card = INSIGHT_CARDS.find((c) => c.key === key);
              return (
                <View key={key}>
                  {i > 0 ? (
                    <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
                  ) : null}
                  <View style={styles.row}>
                    <Text style={[type.body, { color: theme.text, flex: 1 }]}>
                      {card?.label ?? key}
                    </Text>
                    <Pressable
                      onPress={() => move(key, -1)}
                      hitSlop={8}
                      disabled={i === 0}
                      accessibilityLabel={`Move ${card?.label} up`}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={18}
                        color={i === 0 ? theme.textFaint : theme.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => move(key, 1)}
                      hitSlop={8}
                      disabled={i === enabled.length - 1}
                      accessibilityLabel={`Move ${card?.label} down`}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={i === enabled.length - 1 ? theme.textFaint : theme.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => toggle(key)}
                      hitSlop={8}
                      accessibilityLabel={`Hide ${card?.label}`}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color={theme.negative} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {enabled.length === 0 ? (
              <Text
                style={[
                  type.label,
                  { color: theme.textFaint, textAlign: 'center', padding: space.lg },
                ]}
              >
                All cards hidden.
              </Text>
            ) : null}
          </View>
        </Glass>

        {INSIGHT_CARDS.some((c) => !enabled.includes(c.key)) ? (
          <>
            <Text
              style={[
                type.caption,
                {
                  color: theme.textFaint,
                  textTransform: 'uppercase',
                  paddingHorizontal: space.xl,
                  marginTop: space.xl,
                  marginBottom: space.md,
                },
              ]}
            >
              Hidden
            </Text>
            <Glass style={styles.card}>
              <View style={{ paddingVertical: space.xs }}>
                {INSIGHT_CARDS.filter((c) => !enabled.includes(c.key)).map((c, i) => (
                  <View key={c.key}>
                    {i > 0 ? (
                      <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
                    ) : null}
                    <Pressable onPress={() => toggle(c.key)} style={styles.row}>
                      <Text style={[type.body, { color: theme.textMuted, flex: 1 }]}>
                        {c.label}
                      </Text>
                      <Ionicons name="add-circle-outline" size={20} color={theme.positive} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </Glass>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  card: { marginHorizontal: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
});
