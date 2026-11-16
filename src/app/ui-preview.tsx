// UI preview (development only): every building block from src/ui in one scrolling page, to check the look,
// motion and dark mode on a real phone. Opened from the small "UI preview" link on the sign-in screen in dev.
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '../context/ThemeContext';
import {
  Button, Card, Glass, GlowScreen, ListRow, Notice, PressableScale, SectionLabel, Skeleton, SkeletonRow,
  SkeletonText, StatusPill, StatusText, SuccessCheck, Techy, TechyMood, Txt, arrive, useReducedMotion, useTokens, tokens,
} from '../ui';

const MOODS: TechyMood[] = ['ready', 'cheer', 'wave', 'worry', 'rest'];

export default function UiPreview() {
  const router = useRouter();
  const { c, space } = useTokens();
  const { isDark, setThemeMode } = useAppTheme();
  const reduced = useReducedMotion();
  const [mood, setMood] = useState<TechyMood>('ready');
  const [play, setPlay] = useState(0);
  const [loading, setLoading] = useState(true);
  if (!__DEV__) return <Redirect href={'/' as Href} />;

  const swatches: [string, string][] = [['canvas', c.canvas], ['card', c.card], ['brand', c.brand], ['tint', c.tint], ['accent', c.accent]];
  const types = Object.keys(tokens.type) as (keyof typeof tokens.type)[];

  return (
    <GlowScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt variant="title">UI preview</Txt>
            <Button kind="ghost" size="md" label="Back" onPress={() => router.back()} />
          </View>
          <Txt variant="caption" color="ink2">Cool air 70/20/10 · Plus Jakarta Sans · reduce motion {reduced ? 'ON' : 'off'}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button kind="secondary" size="md" label={isDark ? 'Light mode' : 'Dark mode'} onPress={() => setThemeMode(isDark ? 'light' : 'dark')} />
          </View>

          <SectionLabel>Glass on the glow + Techy</SectionLabel>
          <Glass style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <StatusPill tone="info" label="Not timed in yet" />
                <Txt variant="display">8:02 AM</Txt>
                <Txt variant="caption" color="ink2">Shift 8:00 AM – 5:00 PM</Txt>
              </View>
              <Techy mood={mood} size={96} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {MOODS.map((m) => <Button key={m} size="md" kind={m === mood ? 'primary' : 'secondary'} label={m} onPress={() => setMood(m)} />)}
            </View>
          </Glass>

          <SectionLabel>Success check</SectionLabel>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <SuccessCheck playKey={play} />
            <View style={{ flex: 1 }}><Txt variant="heading">Timed in at 8:02 AM</Txt><Txt variant="caption" color="ink2">Have a safe day at Batangas beach resort.</Txt></View>
            <Button size="md" kind="secondary" label="Replay" onPress={() => setPlay((p) => p + 1)} />
          </Card>

          <SectionLabel>Buttons</SectionLabel>
          <View style={{ gap: 10 }}>
            <Button label="Time in" icon="log-in" />
            <Button kind="secondary" label="Job details" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button kind="ghost" size="md" label="See all" />
              <Button kind="danger" size="md" label="Sign out" />
              <Button size="md" label="Saving" loading />
            </View>
          </View>

          <SectionLabel>List and status words</SectionLabel>
          <Card padded={false}>
            <ListRow icon="sun" title="Sick leave · Nov 20" right={<StatusText tone="pending" label="Waiting for HR" />} />
            <ListRow icon="tool" title="Vacuum pump" right={<StatusText tone="error" label="Due back today" />} />
            <ListRow icon="check-circle" title="Time-in correction" right={<StatusText tone="ok" label="Fixed" />} />
            <ListRow icon="book-open" title="Company policies" right={<StatusText tone="info" label="2 to read" />} onPress={() => {}} last />
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <StatusPill tone="ok" label="Timed in · 8:02 AM" /><StatusPill tone="pending" label="HR checking" />
            <StatusPill tone="error" label="Declined" /><StatusPill tone="info" label="Upcoming" />
          </View>
          <View style={{ gap: 8, marginTop: 10 }}>
            <Notice tone="error" text="Wrong PIN. 3 tries left." />
            <Notice tone="ok" text="This is now your work phone." />
          </View>

          <SectionLabel>Staggered arrival and skeletons</SectionLabel>
          <Button kind="secondary" size="md" label={loading ? 'Show content' : 'Show skeleton'} onPress={() => setLoading((l) => !l)} />
          <View style={{ marginTop: 10, gap: 10 }}>
            {loading ? (
              <>
                <Card padded={false}><SkeletonRow /><SkeletonRow /></Card>
                <Card><SkeletonText lines={3} /></Card>
                <Skeleton height={90} radius={20} />
              </>
            ) : (
              [0, 1, 2].map((i) => (
                <Animated.View key={i} entering={arrive(i, reduced)}>
                  <Card onPress={() => {}}><Txt variant="heading">Card {i + 1}</Txt><Txt variant="caption" color="ink2">Press me: I shrink a little and spring back.</Txt></Card>
                </Animated.View>
              ))
            )}
          </View>

          <SectionLabel>Colors and type</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {swatches.map(([name, hex]) => (
              <View key={name} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: '100%', height: 40, borderRadius: 10, backgroundColor: hex, borderWidth: 1, borderColor: c.line }} />
                <Txt variant="caption" color="ink2">{name}</Txt>
              </View>
            ))}
          </View>
          <Card style={{ marginTop: 10, gap: 4 }}>
            {types.map((t) => <Txt key={t} variant={t}>{t}: Time in at 8:02</Txt>)}
          </Card>
          <PressableScale style={{ marginTop: 20 }} onPress={() => router.back()}><Txt variant="label" color="brand" center>Back to sign in</Txt></PressableScale>
        </ScrollView>
      </SafeAreaView>
    </GlowScreen>
  );
}
