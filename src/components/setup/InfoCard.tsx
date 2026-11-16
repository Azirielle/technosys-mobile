// A card with an icon chip, a bold line and a short explanation (app-rule points, permissions).
// `status` shows Allowed / Not allowed in the status colors. `index` staggers its arrival (motion #4).
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Card, IconChip, StatusText, Txt, arrive, useReducedMotion } from '../../ui';

type Status = { label: string; tone: 'good' | 'bad' | 'neutral' };
type Props = { icon: React.ComponentProps<typeof Feather>["name"]; title: string; text: string; status?: Status; index?: number };

const TONE = { good: 'ok', bad: 'error', neutral: 'info' } as const;

export default function InfoCard({ icon, title, text, status, index = 1 }: Props) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={arrive(index, reduced)}>
      <Card style={{ flexDirection: 'row', gap: 14 }}>
        <IconChip icon={icon} />
        <View style={{ flex: 1 }}>
          <Txt variant="heading" style={{ fontSize: 15, marginBottom: 2 }}>{title}</Txt>
          <Txt variant="body" color="ink2" style={{ fontSize: 14, lineHeight: 20 }}>{text}</Txt>
          {status && <View style={{ marginTop: 8 }}><StatusText tone={TONE[status.tone]} label={status.label} /></View>}
        </View>
      </Card>
    </Animated.View>
  );
}
