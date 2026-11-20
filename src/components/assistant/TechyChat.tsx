// TechyChat: Techy's chat window. Ask Techy (the AI assistant) about tools, safety, your DTR, leaves or company rules.
// Shown by TechyChatLayer when you tap Techy: your unfinished Techy chat, or a new one. The only button at the top is
// "End"; Techy itself sits in the empty seat at the top-left (drawn by the layer) and is the Back button: it closes
// the window and keeps the chat for later. Once HR takes over, Techy stays quiet and your messages go to HR. When HR
// closes it, the chat shows that at once (live) and you can't send more. (HR replies in the Inbox open app/ticket/[id].tsx instead.)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useT } from '../../lib/i18n';
import {
  type ChatMessage, type Ticket, askTechy, endConversation, isFinished, listenToConversation, mergeMessage, openConversation,
  saveTechyAnswer, sendMine, startChat, techyAnswers,
} from '../../lib/assistant';
import ChatBubble from './ChatBubble';
import ChatComposer from './ChatComposer';
import { SEAT, SEAT_LEFT, SEAT_TOP } from './useTechyOpening';
import { Notice, Txt, haptic, useTokens } from '../../ui';

const STREAM_ID = 'stream'; // Techy's answer while it is still being written

type Props = { onEnd: () => void; dimStyle: AnimatedStyle<ViewStyle> };

export default function TechyChat({ onEnd, dimStyle }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
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
    let gone = false; // closed before it finished loading: don't start listening
    openConversation()
      .then(({ ticket: found, messages: shown }) => { if (gone) return; if (found) { setTicket(found); listen(found.id); } setMessages(shown); })
      .catch(() => { if (!gone) setProblem('load'); })
      .finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; stopListening.current?.(); stopAsking.current?.(); };
  }, [listen, setTicket]);

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
  const finished = isFinished(ticket);
  const subtitle = finished ? t('hrChat.finished') : hrHasIt ? t('assistant.hrAnswering') : ticket && !techyAnswers(ticket) ? ticket.title : t('assistant.role');
  const shown = messages.length || loading ? messages : [{ id: 'hello', from: 'techy' as const, text: t('assistant.hello') }];
  const thinking = asking && !messages.find((m) => m.id === STREAM_ID)?.text;

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: SEAT_TOP, paddingLeft: SEAT_LEFT, paddingRight: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
            {/* Techy's seat (Techy lands here, drawn on top) is the Back button: closes the window, keeps the chat */}
            <Pressable onPress={() => { haptic.tap(); onEnd(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}
              style={{ width: SEAT, height: SEAT, justifyContent: 'center' }}>
              <Feather name="chevron-left" size={14} color={c.ink2} style={{ position: 'absolute', left: -SEAT_LEFT }} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Txt variant="heading" accessibilityRole="header">{t('assistant.name')}</Txt>
              <Txt variant="caption" color={hrHasIt ? 'brand' : 'ink2'} numberOfLines={1}>{subtitle}</Txt>
            </View>
            <Pressable onPress={end} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('assistant.endHint')}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.round, backgroundColor: c.cardSoft }}>
              <Txt variant="label">{t('assistant.end')}</Txt>
            </Pressable>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" /* Android draws edge-to-edge and no longer resizes for the keyboard */>
            <FlatList
              ref={list}
              data={shown}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (item.id === STREAM_ID && !item.text ? null : <ChatBubble message={item} onLeave={onEnd} />)}
              contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={thinking ? <Txt variant="caption" color="ink2" style={{ marginTop: 4 }}>{t('assistant.thinking')}</Txt> : null}
            />
            {problem && <View style={{ paddingHorizontal: 14 }}><Notice tone="error" text={t(problem === 'load' ? 'assistant.loadFailed' : 'common.noSignal')} /></View>}
            {finished ? (
              <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.line }}><Notice tone="ok" text={t('assistant.closedNote')} /></View>
            ) : (
              <ChatComposer value={input} onChangeText={setInput} onSend={send} busy={asking} sendLabel={t('assistant.send')}
                placeholder={hrHasIt || !techyAnswers(ticket) ? t('assistant.placeholderHr') : t('assistant.placeholder')} />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
        {/* in the page's shadow until the page has turned away */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }, dimStyle]} />
    </View>
  );
}
