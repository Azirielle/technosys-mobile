// TechyChat: Techy's chat window. Ask Techy (the AI assistant) about tools, safety, your DTR, leaves or company rules.
// Shown by TechyChatLayer (tap Techy, or an HR reply in the Inbox opens it on that ticket). The only button at the top
// is "End"; Techy itself sits in the empty seat at the top-left (drawn by the layer). Once HR takes over, Techy stays
// quiet and your messages go to HR.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import {
  type ChatMessage, type Ticket, askTechy, endConversation, listenToConversation, mergeMessage, openConversation,
  saveTechyAnswer, sendMine, startChat, techyAnswers,
} from '../../lib/assistant';
import ChatBubble from './ChatBubble';
import { SEAT, SEAT_LEFT, SEAT_TOP } from './useTechyOpening';
import { Notice, Txt, haptic, useTokens } from '../../ui';

const STREAM_ID = 'stream'; // Techy's answer while it is still being written

type Props = { ticketId?: string; onEnd: () => void; dimStyle: AnimatedStyle<ViewStyle> };

export default function TechyChat({ ticketId, onEnd, dimStyle }: Props) {
  const t = useT();
  const { c, radius, fonts } = useTokens();
  const [ticket, setTicketState] = useState<Ticket | null>(null);
  const ticketRef = useRef<Ticket | null>(null); // the latest ticket for code running after an await
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<'load' | 'send' | null>(null);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const stopListening = useRef<(() => void) | null>(null);
  const stopAsking = useRef<(() => void) | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);

  const setTicket = useCallback((next: Ticket) => { ticketRef.current = next; setTicketState(next); }, []);
  const listen = useCallback((id: string) => {
    stopListening.current?.();
    stopListening.current = listenToConversation(id, setTicket, (m) => setMessages((all) => mergeMessage(all, m)));
  }, [setTicket]);

  useEffect(() => {
    openConversation(ticketId)
      .then(({ ticket: found, messages: shown }) => { if (found) { setTicket(found); listen(found.id); } setMessages(shown); })
      .catch(() => setProblem('load'))
      .finally(() => setLoading(false));
    return () => { stopListening.current?.(); stopAsking.current?.(); };
  }, [ticketId, listen, setTicket]);

  const send = async () => {
    const text = input.trim();
    if (!text || asking) return;
    haptic.tap();
    setInput(''); setProblem(null);
    const pendingId = `mine_${Date.now()}`;
    const before = messages;
    setMessages((all) => [...all, { id: pendingId, from: 'me', text, pending: true }]);

    let current = ticketRef.current;
    if (!current) {
      current = await startChat(text);
      if (current) { setTicket(current); listen(current.id); }
    }
    const savedId = current ? await sendMine(current.id, text) : null;
    if (!current || !savedId) {
      setMessages((all) => all.filter((m) => m.id !== pendingId));
      setInput(text); setProblem('send'); haptic.error();
      return;
    }
    setMessages((all) => all.map((m) => (m.id === pendingId ? { ...m, id: savedId, pending: false } : m)));
    if (!techyAnswers(ticketRef.current)) return; // HR has this conversation: no Techy answer

    const ticketNow = current;
    setAsking(true);
    setMessages((all) => [...all, { id: STREAM_ID, from: 'techy', text: '', pending: true }]);
    const finish = (replace: (all: ChatMessage[]) => ChatMessage[]) => { setMessages(replace); setAsking(false); stopAsking.current = null; };
    stopAsking.current = await askTechy(text, before, {
      text: (piece) => setMessages((all) => all.map((m) => (m.id === STREAM_ID ? { ...m, text: m.text + piece } : m))),
      done: async (full) => {
        const answerId = await saveTechyAnswer(ticketNow.id, full);
        // Refused = HR took over while Techy was typing: drop the answer so the phone matches what HR sees
        finish((all) => (answerId ? all.map((m) => (m.id === STREAM_ID ? { ...m, id: answerId, pending: false } : m)) : all.filter((m) => m.id !== STREAM_ID)));
      },
      fail: () => finish((all) => all.map((m) => (m.id === STREAM_ID ? { id: `fail_${Date.now()}`, from: 'note', text: t('assistant.failed') } : m))),
    });
  };

  const end = () => {
    haptic.tap();
    stopAsking.current?.();
    endConversation(ticketRef.current).catch(() => {});
    onEnd();
  };

  const hrHasIt = ticket?.handling_mode === 'ADMIN';
  const subtitle = hrHasIt ? t('assistant.hrAnswering') : ticket && !techyAnswers(ticket) ? ticket.title : t('assistant.role');
  const shown = messages.length || loading ? messages : [{ id: 'hello', from: 'techy' as const, text: t('assistant.hello') }];
  const thinking = asking && !messages.find((m) => m.id === STREAM_ID)?.text;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: SEAT_TOP, paddingLeft: SEAT_LEFT, paddingRight: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <View style={{ width: SEAT, height: SEAT }} />{/* Techy's seat: Techy lands here (drawn on top) */}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Txt variant="heading" accessibilityRole="header">{t('assistant.name')}</Txt>
              <Txt variant="caption" color={hrHasIt ? 'brand' : 'ink2'} numberOfLines={1}>{subtitle}</Txt>
            </View>
            <Pressable onPress={end} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('assistant.endHint')}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.round, backgroundColor: c.cardSoft }}>
              <Txt variant="label">{t('assistant.end')}</Txt>
            </Pressable>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlatList
              ref={list}
              data={shown}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (item.id === STREAM_ID && !item.text ? null : <ChatBubble message={item} />)}
              contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={thinking ? <Txt variant="caption" color="ink2" style={{ marginTop: 4 }}>{t('assistant.thinking')}</Txt> : null}
            />
            {problem && <View style={{ paddingHorizontal: 14 }}><Notice tone="error" text={t(problem === 'load' ? 'assistant.loadFailed' : 'common.noSignal')} /></View>}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.line }}>
              <TextInput value={input} onChangeText={setInput} multiline maxLength={1000}
                placeholder={hrHasIt || !techyAnswers(ticket) ? t('assistant.placeholderHr') : t('assistant.placeholder')} placeholderTextColor={c.ink3}
                accessibilityLabel={t('assistant.placeholder')}
                style={{ flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, borderRadius: radius.control, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, fontFamily: fonts.regular, fontSize: 15 }} />
              <Pressable onPress={send} disabled={!input.trim() || asking} accessibilityRole="button" accessibilityLabel={t('assistant.send')}
                style={{ width: 44, height: 44, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand, opacity: !input.trim() || asking ? 0.4 : 1 }}>
                <Feather name="send" size={19} color={c.onBrand} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {/* in the page's shadow until the page has turned away */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }, dimStyle]} />
    </View>
  );
}
