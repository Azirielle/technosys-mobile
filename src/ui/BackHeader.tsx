// BackHeader: the back arrow at the top of a pushed screen (Handbook, a DTR day, Ask HR). Back returns to
// wherever you came from, because the app's root is a stack.
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTokens } from './useTokens';

export default function BackHeader({ label }: { label: string }) {
  const router = useRouter();
  const { c } = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 4 }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={8}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={label}>
        <Feather name="arrow-left" size={22} color={c.ink} />
      </Pressable>
    </View>
  );
}
