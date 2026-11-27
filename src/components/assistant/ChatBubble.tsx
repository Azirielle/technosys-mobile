// ChatBubble: one message in Techy's chat. Yours on the right; Techy's and HR's on the left (Techy's with simple
// formatting: **bold** and "- " lists); notes like "HR has joined" in the middle. When Techy offers something, the
// answer ends with only that one thing (Andrew 27 Nov): the DTR or Others form right here, or one button to a screen.
import React from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import type { ChatMessage } from '../../lib/assistant';
import { readAction } from '../../lib/techyAction';
import { Card, ListRow, Txt, useTokens } from '../../ui';
import ChatForm, { formUsable } from './ChatForm';

const GO = {
  leave: { icon: 'sun', to: '/leave-new' }, tools: { icon: 'tool', to: '/tools' }, timein: { icon: 'log-in', to: '/(tabs)' },
  dtr: { icon: 'calendar', to: '/dtr' }, jobs: { icon: 'briefcase', to: '/(tabs)/jobs' },
} as const;

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

/** onLeave: in Techy's chat, a button first closes the chat, so Back from the screen returns to yours.
 *  canFile: the chat is still Techy's, so a form can be sent from it (once sent, HR has it and forms stop showing). */
export default function ChatBubble({ message, onLeave, canFile }: { message: ChatMessage; onLeave?: () => void; canFile?: boolean }) {
  const t = useT();
  const router = useRouter();
  const { c, radius } = useTokens();

  if (message.from === 'note') {
    return <Txt variant="caption" color="ink2" center style={{ marginVertical: 6, paddingHorizontal: 24 }}>{message.text}</Txt>;
  }

  const mine = message.from === 'me';
  const { text, action: found } = message.from === 'techy' ? readAction(message.text) : { text: message.text, action: null };
  const action = message.pending ? null : found;
  // A DTR form with no usable day falls back to the DTR screen button
  const form = action && 'form' in action && canFile && formUsable({ kind: action.form, date: action.form === 'dtr' ? action.date : null }) ? action : null;
  const go = action && 'go' in action ? action.go : canFile && action && 'form' in action && action.form === 'dtr' && !form ? 'dtr' : null; // once sent, no button in its place
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
      {form && <View style={{ marginTop: 8, width: '86%' }}><ChatForm kind={form.form} date={form.form === 'dtr' ? form.date : null} /></View>}
      {go && (
        <Card padded={false} style={{ marginTop: 8, width: '86%' }}>
          <ListRow icon={GO[go].icon} title={t(`assistant.go.${go}`)} onPress={() => { onLeave?.(); router.push(GO[go].to as Href); }} last />
        </Card>
      )}
    </View>
  );
}
