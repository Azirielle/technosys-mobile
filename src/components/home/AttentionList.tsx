// "Needs your attention" on Home: leave waiting for HR or not approved, policies to read, shifts HR is checking.
// Each row says its status in words and opens the place to deal with it. Nothing pending = one calm line.
import React from 'react';
import { useT } from '../../lib/i18n';
import type { AttentionItem } from '../../lib/homeSummary';
import { Card, ListRow, StatusText, type Tone } from '../../ui';

const ICON = { leave: 'sun', policy: 'book-open', shift: 'clock' } as const;
const STATUS: Record<AttentionItem['status'], { tone: Tone; key: string }> = {
  waiting: { tone: 'pending', key: 'home.waitingHr' },
  notApproved: { tone: 'error', key: 'home.notApproved' },
  toRead: { tone: 'info', key: 'home.toRead' },
  checking: { tone: 'pending', key: 'dtr.hrChecking' },
};

export default function AttentionList({ items, onOpen }: { items: AttentionItem[]; onOpen: (item: AttentionItem) => void }) {
  const t = useT();
  if (!items.length) return <Card><StatusText tone="ok" label={t('home.allClear')} /></Card>;
  return (
    <Card padded={false}>
      {items.map((item, i) => {
        const vars = item.kind === 'leave' && item.vars ? { ...item.vars, type: t(`home.leaveTypes.${item.vars.type}`) } : item.vars;
        const s = STATUS[item.status];
        return (
          <ListRow key={item.key} icon={ICON[item.kind]} title={t(item.title, vars)} onPress={() => onOpen(item)}
            right={<StatusText tone={s.tone} label={t(s.key)} />} last={i === items.length - 1} />
        );
      })}
    </Card>
  );
}
