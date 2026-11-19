// ChatBubble: one message in Techy's chat. Yours on the right; Techy's and HR's on the left (Techy's with simple
// formatting: **bold** and "- " lists); notes like "HR has joined" in the middle. When Techy suggests a form, the
// answer ends with shortcuts to the right screens instead of the hidden code.
import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import { FORM_TOKEN, type ChatMessage } from '../../lib/assistant';
import { Card, ListRow, Txt, useTokens } from '../../ui';

const SHORTCUTS = [
  { key: 'dtr', icon: 'calendar', to: '/dtr' },
  { key: 'leave', icon: 'sun', to: '/leave-new' },
  { key: 'tool', icon: 'tool', to: '/tools' },
] as const;

/** "**bold** text" → pieces of plain and bold text. */
function Inline({ text, color }: { text: string; color: 'ink' | 'onBrand' }) {
  return (
    <Txt variant="body" color={color}>
      {text.split(/\*\*(.*?)\*\*/g).map((part, i) => (i % 2 ? <Txt key={i} variant="label" color={color} style={{ fontSize: 15 }}>{part}</Txt> : part))}
    </Txt>
  );
}

function Formatted({ text, color }: { text: string; color: 'ink' | 'onBrand' }) {
  return (
    <View style={{ gap: 4 }}>
      {text.split('\n').map((line, i) => {
        const item = line.match(/^\s*[-*•]\s+(.*)/);
        if (!line.trim()) return null;
        if (!item) return <Inline key={i} text={line.replace(/^#+\s*/, '')} color={color} />;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 6, paddingLeft: line.search(/\S/) > 1 ? 14 : 0 }}>
            <Txt variant="body" color={color}>•</Txt>
            <View style={{ flex: 1 }}><Inline text={item[1]} color={color} /></View>
          </View>
        );
      })}
    </View>
  );
}

/** onLeave: in Techy's chat, a shortcut first closes the chat, so Back from the form returns to your screen. */
export default function ChatBubble({ message, onLeave }: { message: ChatMessage; onLeave?: () => void }) {
  const t = useT();
  const router = useRouter();
  const { c, radius } = useTokens();

  if (message.from === 'note') {
    return <Txt variant="caption" color="ink2" center style={{ marginVertical: 6, paddingHorizontal: 24 }}>{message.text}</Txt>;
  }

  const mine = message.from === 'me';
  const wantsForm = message.from === 'techy' && message.text.includes(FORM_TOKEN);
  const text = message.text.replace(FORM_TOKEN, '').trim();
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
      <View style={{
        maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.card,
        backgroundColor: mine ? c.brand : c.card, opacity: message.pending && mine ? 0.7 : 1,
        [mine ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 6,
      }}>
        {message.from === 'hr' && <Txt variant="caption" color="brand" style={{ marginBottom: 2 }}>{t('assistant.hr')}</Txt>}
        {mine ? <Txt variant="body" color="onBrand">{text}</Txt> : <Formatted text={text} color="ink" />}
      </View>
      {wantsForm && !message.pending && (
        <Card padded={false} style={{ marginTop: 8, width: '86%' }}>
          {SHORTCUTS.map((s, i) => (
            <ListRow key={s.key} icon={s.icon} title={t(`assistant.shortcut.${s.key}`)} onPress={() => { onLeave?.(); router.push(s.to as Href); }}
              last={i === SHORTCUTS.length - 1} />
          ))}
        </Card>
      )}
    </View>
  );
}
