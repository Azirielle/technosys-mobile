import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import EventSource from 'react-native-sse';

const BRAND = {
  blue: '#1E3A8A',    
  yellow: '#FBBF24',  
  green: '#10B981',   
  lightBg: '#F8FAFC',
};

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  progressSteps: string[];
  isStreaming: boolean;
  attachment?: { name: string, uri: string };
}

export default function SupportChatUI({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      text: "Mabuhay! I am your AI Support Assistant. Ask me anything about the equipment manuals or operations.",
      progressSteps: [],
      isStreaming: false
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!activeQueueId || !activeAiMessageId) return;

    const channel = supabase
      .channel(`queue_tracker_${activeQueueId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ai_chat_queue',
        filter: `id=eq.${activeQueueId}`
      }, (payload) => {
        if (payload.new.status === 'completed') {
          setMessages(prev => prev.map(m => 
            m.id === activeAiMessageId 
              ? { ...m, text: payload.new.response, isStreaming: false, progressSteps: [...m.progressSteps, "Answer received from queue."] } 
              : m
          ));
          setIsTyping(false);
          setActiveQueueId(null);
          setActiveAiMessageId(null);
        } else if (payload.new.status === 'failed') {
          setMessages(prev => prev.map(m => 
            m.id === activeAiMessageId 
              ? { ...m, text: "\n\n**Queue Error:** " + payload.new.response, isStreaming: false } 
              : m
          ));
          setIsTyping(false);
          setActiveQueueId(null);
          setActiveAiMessageId(null);
        }
      })
      .subscribe();

    // Polling for queue position
    const interval = setInterval(async () => {
       const { data } = await supabase.from('ai_chat_queue').select('id').eq('id', activeQueueId).single();
       if (!data) return;
       const { count } = await supabase.from('ai_chat_queue').select('*', { count: 'exact', head: true })
         .eq('status', 'waiting')
         .lt('created_at', new Date().toISOString()); // Simplification, gets all waiting items
         
       if (count !== null) {
          setMessages(prev => prev.map(m => 
            m.id === activeAiMessageId 
              ? { ...m, progressSteps: m.progressSteps.filter(s => !s.includes("You are #")).concat(`You are #${count + 1} in queue...`) }
              : m
          ));
       }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeQueueId, activeAiMessageId]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText.trim(),
      progressSteps: [],
      isStreaming: false,
      attachment: attachedFile ? { name: attachedFile.name, uri: attachedFile.uri } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setAttachedFile(null);
    setIsTyping(true);

    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'ai',
      text: "",
      progressSteps: [],
      isStreaming: true
    };
    
    setMessages(prev => [...prev, aiMessage]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Replace with your actual edge function URL
      const EDGE_FUNCTION_URL = "https://ggknkdyuglzcnkwhvdak.supabase.co/functions/v1/chat-support";

      const es = new EventSource(EDGE_FUNCTION_URL, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ query: userMessage.text, attachment: attachedFile }),
      });

      es.addEventListener("message", (event: any) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "progress") {
             setMessages(prev => prev.map(m => {
                if (m.id === aiMessageId) {
                  return { ...m, progressSteps: [...m.progressSteps, data.message] };
                }
                return m;
             }));
          } 
          else if (data.type === "text") {
             setMessages(prev => prev.map(m => {
                if (m.id === aiMessageId) {
                  return { ...m, text: m.text + data.text };
                }
                return m;
             }));
          }
          else if (data.type === "rate_limited") {
             es.close();
             setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, progressSteps: [...m.progressSteps, "High traffic. Queuing your request..."] } : m));
             supabase.from('ai_chat_queue').insert({
               user_id: session.user.id,
               query: userMessage.text,
               status: 'waiting'
             }).select().single().then(({ data: queueItem }) => {
                if (queueItem) {
                   setActiveQueueId(queueItem.id);
                   setActiveAiMessageId(aiMessageId);
                }
             });
          }
          else if (data.type === "done" || data.type === "error") {
             if (data.type === "error") {
               setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: m.text + "\n\n**Error:** " + data.message, isStreaming: false } : m));
             } else {
               setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, isStreaming: false } : m));
             }
             setIsTyping(false);
             es.close();
          }
        } catch (e) {
          console.error("Error parsing SSE:", e);
        }
      });

      es.addEventListener("error", (err) => {
        console.error("SSE Error:", err);
        setIsTyping(false);
        setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, isStreaming: false, text: m.text || "Connection failed." } : m));
        es.close();
      });

    } catch (error) {
      console.error(error);
      setIsTyping(false);
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, isStreaming: false, text: "Connection error. If you attached a file, it might be too large. Please try again without the file." } : m));
    }
  };

const MarkdownText = ({ text, style }: { text: string, style: any }) => {
  const paragraphs = text.split('\n');
  return (
    <View>
      {paragraphs.map((paragraph, pIdx) => {
        if (paragraph.trim() === '') return <View key={pIdx} style={{ height: 4 }} />;
        const parts = paragraph.split(/\*\*(.*?)\*\*/g);
        return (
          <Text key={pIdx} style={[style, { marginBottom: 6 }]}>
            {parts.map((part, index) => {
              if (index % 2 === 1) {
                return <Text key={index} style={[style, { fontWeight: 'bold', color: '#0F172A' }]}>{part}</Text>;
              }
              // Handle italics
              const italicParts = part.split(/\*(.*?)\*/g);
              if (italicParts.length > 1) {
                 return italicParts.map((iPart, iIdx) => {
                    if (iIdx % 2 === 1) return <Text key={iIdx} style={[style, { fontStyle: 'italic' }]}>{iPart}</Text>;
                    return <Text key={iIdx} style={style}>{iPart}</Text>;
                 });
              }
              return <Text key={index} style={style}>{part}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Support</Text>
          <View style={{width: 24}}/>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.chatContainer}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
                {!isUser && (
                  <View style={styles.avatarAI}>
                    <Ionicons name="hardware-chip" size={16} color="#FFF" />
                  </View>
                )}
                
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
                    {/* Render User Attachment if present */}
                    {isUser && item.attachment && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8, marginBottom: item.text ? 8 : 0 }}>
                        <Ionicons name="document-text" size={16} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFF', fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
                          {item.attachment.name}
                        </Text>
                      </View>
                    )}

                  {/* Render Progress Steps for AI */}
                  {!isUser && item.progressSteps.length > 0 && (
                    <View style={styles.progressContainer}>
                      {item.progressSteps.map((step, idx) => (
                        <View key={idx} style={styles.progressStep}>
                          {(item.isStreaming && idx === item.progressSteps.length - 1) ? (
                            <ActivityIndicator size="small" color={BRAND.blue} />
                          ) : (
                            <Ionicons name="checkmark-circle" size={16} color={BRAND.green} />
                          )}
                          <Text style={styles.progressText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {item.text.length > 0 && (
                    isUser ? (
                      <Text style={[styles.messageText, styles.messageTextUser]}>{item.text}</Text>
                    ) : (
                      <MarkdownText text={item.text} style={[styles.messageText, styles.messageTextAI]} />
                    )
                  )}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputContainer}>
        {attachedFile && (
          <View style={{ position: "absolute", top: -40, left: 16, backgroundColor: "#E2E8F0", padding: 8, borderRadius: 8, flexDirection: "row", alignItems: "center" }}>
            <Feather name="paperclip" size={14} color="#475569" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: "#475569", marginRight: 8 }} numberOfLines={1}>{attachedFile.name}</Text>
            <TouchableOpacity onPress={() => setAttachedFile(null)}><Feather name="x" size={14} color="#EF4444" /></TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={{ padding: 8, marginRight: 8, backgroundColor: "#F1F5F9", borderRadius: 20 }} onPress={async () => { const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true }); if(!res.canceled) { const file = res.assets[0]; const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 }); setAttachedFile({ base64, mimeType: file.mimeType, name: file.name }); } }}> <Feather name="paperclip" size={20} color={attachedFile ? BRAND.blue : "#64748B"} /> </TouchableOpacity> <TextInput style={styles.input} placeholder="Ask about procedures, manuals..." value={inputText} onChangeText={setInputText} onSubmitEditing={sendMessage} multiline={true} placeholderTextColor='#94A3B8' />
          <TouchableOpacity 
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={sendMessage}
            disabled={!inputText.trim() || isTyping}
          >
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', fontSize: 10, color: '#94A3B8', marginTop: 8, fontFamily: 'DMSans-Regular' }}>Attachments maximum 5MB</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.lightBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0'
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BRAND.blue,
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageRowAI: {
    alignSelf: 'flex-start',
  },
  avatarAI: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: BRAND.blue,
    borderTopRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 150,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 8,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#FFF',
  },
  messageTextAI: {
    color: '#334155',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    marginLeft: 12,
    backgroundColor: BRAND.blue,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});




