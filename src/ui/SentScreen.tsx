// SentScreen: what you see after sending something to the office (Ask HR, a tool problem, a leave): the green
// check draws itself, a title, one line on what happens next, and Done (back to where you were).
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from './Button';
import SuccessCheck from './SuccessCheck';
import Txt from './Txt';
import { useTokens } from './useTokens';

export default function SentScreen({ title, text, doneLabel, onDone }: { title: string; text: string; doneLabel: string; onDone: () => void }) {
  const { c, space } = useTokens();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: 12 }} accessibilityLiveRegion="polite">
        <SuccessCheck size={72} />
        <Txt variant="title" style={{ textAlign: 'center' }}>{title}</Txt>
        <Txt variant="body" color="ink2" style={{ textAlign: 'center' }}>{text}</Txt>
      </View>
      <View style={{ padding: space.lg }}><Button label={doneLabel} onPress={onDone} /></View>
    </SafeAreaView>
  );
}
