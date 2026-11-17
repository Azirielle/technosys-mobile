// Three same-size shortcuts on Home: My tools, File leave, your DTR. Same chip color for all
// (color is only for status words).
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import { Card, IconChip, Txt } from '../../ui';

type Props = { toolsWithYou: number; onTools: () => void; onLeave: () => void; onDtr: () => void };

export default function QuickActions({ toolsWithYou, onTools, onLeave, onDtr }: Props) {
  const t = useT();
  const tiles = [
    { key: 'tools', icon: 'tool', title: t('home.myTools'), sub: toolsWithYou ? t('home.toolsWithYou', { n: toolsWithYou }) : t('home.noTools'), onPress: onTools },
    { key: 'leave', icon: 'sun', title: t('home.fileLeave'), sub: t('home.fileLeaveSub'), onPress: onLeave },
    { key: 'dtr', icon: 'clipboard', title: t('tabs.dtr'), sub: t('home.dtrSub'), onPress: onDtr },
  ] as const;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {tiles.map((x) => (
        <Card key={x.key} onPress={x.onPress} accessibilityLabel={x.title} style={{ flex: 1, gap: 8, paddingVertical: 14 }}>
          <IconChip icon={x.icon} size="sm" />
          <View>
            <Txt variant="label" numberOfLines={1}>{x.title}</Txt>
            <Txt variant="caption" color="ink2" numberOfLines={1}>{x.sub}</Txt>
          </View>
        </Card>
      ))}
    </View>
  );
}
