// Conversation with HR about one ticket (opened from an HR reply in the Inbox): your question, HR's replies, and a box
// to answer HR. Techy isn't part of it (Techy's chat is opened by tapping Techy). Updates live when HR writes.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../../lib/i18n';
import { type ChatMessage, type Ticket, listenToConversation, mergeMessage, openConversation, sendMine } from '../../lib/assistant';
import ChatBubble from '../../components/assistant/ChatBubble';
import ChatComposer from '../../components/assistant/ChatComposer';
import { BackHeader, Notice, SkeletonRow, StatusPill, Txt, haptic, useTokens } from '../../ui';

const FINISHED = ['resolved', 'closed'];

export default function TicketChatScreen() {
  const t = useT();
  const { c, space } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<'load' | 'send' | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!id) return;
    let stop: (() => void) | null = null;
    let gone = false; // left the screen before it finished loading: don't start listening
    openConversation(id)
      .then(({ ticket: found, messages: shown }) => {
        if (gone) return;
        if (!found) { setProblem('load'); return; }
        setTicket(found); setMessages(shown);
        stop = listenToConversation(found.id, setTicket, (m) => setMessages((all) => mergeMessage(all, m)));
      })
      .catch(() => { if (!gone) setProblem('load'); })
      .finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; stop?.(); };
  }, [id]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !ticket || sending) return;
    haptic.tap();
    const pendingId = `mine_${Date.now()}`;
    setInput(''); setProblem(null); setSending(true);
    setMessages((all) => [...all, { id: pendingId, from: 'me', text, pending: true }]);
    const savedId = await sendMine(ticket.id, text);
    setSending(false);
    if (!savedId) { // not sent: take it back and keep the text so nothing is lost
      setMessages((all) => all.filter((m) => m.id !== pendingId));
      setInput(text); setProblem('send'); haptic.error();
      return;
    }
    setMessages((all) => all.map((m) => (m.id === pendingId ? { ...m, id: savedId, pending: false } : m)));
  }, [input, ticket, sending]);

  const finished = !!ticket && FINISHED.includes(ticket.status);
  // Under your latest message, until HR answers: "Sending…", then "Sent · HR will reply here"
  const last = messages[messages.length - 1];
  const note = last?.from === 'me' && !finished ? t(last.pending ? 'hrChat.sending' : 'hrChat.sent') : null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
      <BackHeader label={t('common.back')} />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Txt variant="caption" color="ink2">{t('hrChat.title')}</Txt>
        <Txt variant="heading" accessibilityRole="header" numberOfLines={2}>{ticket?.title ?? ' '}</Txt>
        {/* Full-color status, a step larger than list pills: easy to read for weaker eyes too (Andrew, 19 Nov) */}
        {!!ticket && <View style={{ marginTop: 6 }}><StatusPill large tone={finished ? 'ok' : 'info'} label={t(finished ? 'hrChat.finished' : 'hrChat.open')} /></View>}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={{ padding: space.lg, gap: 10 }}><SkeletonRow /><SkeletonRow /></View>
        ) : (
          <FlatList ref={list} data={messages} keyExtractor={(m) => m.id} renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={{ padding: 14, paddingBottom: 8 }} keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={note ? <Txt variant="label" color="ink2" style={{ alignSelf: 'flex-end', marginTop: 4 }}>{note}</Txt> : null} />
        )}
        {problem && <View style={{ paddingHorizontal: 14 }}><Notice tone="error" text={t(problem === 'load' ? 'assistant.loadFailed' : 'common.noSignal')} /></View>}
        {finished ? (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.line }}><Notice tone="ok" text={t('hrChat.finishedNote')} /></View>
        ) : ticket ? (
          <ChatComposer value={input} onChangeText={setInput} onSend={send} busy={sending} placeholder={t('assistant.placeholderHr')} sendLabel={t('assistant.send')} />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
