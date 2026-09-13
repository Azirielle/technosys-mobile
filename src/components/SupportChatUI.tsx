import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Alert, ScrollView , LayoutAnimation, UIManager, Image, Linking } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons, Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';
import EventSource from 'react-native-sse';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../hooks/use-theme';
import TicketSubmissionModal from './TicketSubmissionModal';

const BRAND = {
  blue: '#1E3A8A',    
  yellow: '#FBBF24',  
  green: '#10B981',   
  lightBg: '#F8FAFC',
};

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  progressSteps: string[];
  isStreaming: boolean;
  attachment?: { name: string, uri: string };
  attachment_url?: string | null;
  attachment_type?: string | null;
  sender_role?: string;
}

export interface SupportChatUIProps {
  onClose: () => void;
  initialQuery?: string;
  ticketId?: string;
  initialTicketData?: {
    category?: string;
    logId?: string;
    logDate?: string;
    recordedIn?: string;
    recordedOut?: string;
    expectedIn?: string;
    expectedOut?: string;
    totalHours?: string | number;
    reason?: string;
  } | null;
}

export default function SupportChatUI({ onClose, initialQuery, ticketId, initialTicketData }: SupportChatUIProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const getCatColor = (cat: string) => { 
    if (cat === 'Payroll Issue') return '#10B981'; 
    if (cat === 'Equipment Issue') return '#F59E0B'; 
    if (cat === 'DTR Issue') return '#6366F1';
    if (cat === 'File Leave') return '#EF4444'; 
    if (cat === 'Others') return '#8B5CF6';
    return '#3B82F6'; 
  };
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatAttachment, setChatAttachment] = useState<{ uri: string, name: string, mimeType: string } | null>(null);
  const [isUploadingChatAttachment, setIsUploadingChatAttachment] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const broadcastChannelRef = useRef<any>(null);

  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.docx', '.doc', '.xlsx', '.xls'];
  const ALLOWED_MIME_TYPES = [
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  const validateAttachment = (file: { name: string, size?: number, mimeType?: string }) => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeValid = file.mimeType ? (
      ALLOWED_MIME_TYPES.includes(file.mimeType.toLowerCase()) || 
      file.mimeType.startsWith('image/')
    ) : isExtValid;

    if (!isExtValid && !isMimeValid) {
      Alert.alert(
        "Unsupported File Type",
        "Only images (PNG, JPG, screenshots), PDF, Word (.docx), and Excel (.xlsx) files are supported."
      );
      return false;
    }

    if (file.size && file.size > 5 * 1024 * 1024) {
      Alert.alert("File Too Large", "Attachments are limited to a maximum of 5MB.");
      return false;
    }

    return true;
  };

  const getFilePayload = async (uri: string) => {
    try {
      if (Platform.OS === 'web') {
        const resp = await fetch(uri);
        return await resp.blob();
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = typeof atob !== 'undefined' 
        ? atob(base64) 
        : (typeof (globalThis as any).Buffer !== 'undefined') 
          ? (globalThis as any).Buffer.from(base64, 'base64').toString('binary') 
          : '';
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.warn("Fallback to fetch blob:", e);
      const resp = await fetch(uri);
      return await resp.blob();
    }
  };
  
  const sendRealtimeBroadcast = (event: string, payload: any) => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      }
    } catch (e) {
      console.warn("Realtime broadcast error:", e);
    }
  };

  useEffect(() => {
    // Establish a global broadcast channel for sending updates to Admin
    const ch = supabase.channel('system-updates', {
      config: {
        broadcast: { self: false },
      },
    });
    ch.subscribe();
    broadcastChannelRef.current = ch;
    return () => {
      if (broadcastChannelRef.current) supabase.removeChannel(broadcastChannelRef.current);
    };
  }, []);


  useEffect(() => {
    loadActiveTicket(false, ticketId);
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [ticketId]);

  const loadActiveTicket = async (forceNew = false, specificTicketId?: string) => {
    if (forceNew) {
      setActiveTicket(null);
      setMessages([{ id: '1', role: 'ai', text: "Mabuhay! I am your AI Support Assistant. Ask me anything about the equipment manuals or operations.", progressSteps: [], isStreaming: false }]);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    let tickets;
    if (specificTicketId) {
      const res = await supabase.from('tickets').select('*').eq('id', specificTicketId).single();
      tickets = res.data ? [res.data] : [];
    } else {
      const res = await supabase
        .from('tickets')
        .select('*')
        .eq('employee_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      tickets = res.data;
    }

    if (tickets && tickets.length > 0) {
      const ticket = tickets[0];
      setActiveTicket(ticket);
      
      // Load comments
      const { data: comments } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
        
      // Reconstruct history
      const history: any[] = [];
      // 1. Original submission (only if no comments exist to prevent duplicating the form submission)
      if ((!comments || comments.length === 0) && ticket.description && ticket.description !== 'User initiated an AI support chat.') {
        history.push({
          id: 'orig_' + ticket.id,
          role: 'user',
          text: ticket.description,
          attachment_url: ticket.attachment_url,
          attachment_type: ticket.attachment_type,
          progressSteps: [],
          isStreaming: false
        });
      }
      
      // 2. Comments
      if (comments) {
        comments.forEach(c => {
          if (c.is_internal) return; // Skip internal
          history.push({
            id: c.id,
            role: c.sender_role === 'system' ? 'system' : (c.sender_role === 'admin' || c.sender_role === 'ai') ? 'ai' : 'user',
            text: c.content,
            attachment_url: c.attachment_url,
            attachment_type: c.attachment_type,
            progressSteps: [],
            isStreaming: false,
            sender_role: c.sender_role
          });
        });
      }
      setMessages(history);

      // Subscribe to new comments
      // Also listen to ticket status changes
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      channelRef.current = supabase.channel(`mobile-chat-${ticket.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticket.id}` }, (payload) => {
          setActiveTicket(payload.new);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticket.id}` }, (payload) => {
          const c = payload.new;
          if (c.is_internal) return;
          setMessages(prev => {
            // Deduplication Check 1: Already exists with exact ID
            if (prev.some(m => m.id === c.id)) return prev;

            // Deduplication Check 2: Reconcile optimistic user message if content and role match
            const optUserIdx = prev.findIndex(m => 
              m.role === 'user' && 
              m.text === c.content && 
              m.id !== c.id &&
              (/^\d+$/.test(m.id) || m.id.includes('_u'))
            );
            if (optUserIdx !== -1) {
              const next = [...prev];
              next[optUserIdx] = {
                ...next[optUserIdx],
                id: c.id,
                attachment_url: c.attachment_url || next[optUserIdx].attachment_url,
                attachment_type: c.attachment_type || next[optUserIdx].attachment_type,
                sender_role: c.sender_role
              };
              return next;
            }

            // Deduplication Check 3: Reconcile optimistic AI message if text matches or currently streaming
            const optAiIdx = prev.findIndex(m => 
              m.role === 'ai' && 
              (m.id === c.id || m.text.trim() === (c.content || '').trim() || m.isStreaming)
            );
            if (optAiIdx !== -1) {
              const next = [...prev];
              next[optAiIdx] = {
                ...next[optAiIdx],
                id: c.id,
                text: c.content,
                isStreaming: false,
                sender_role: c.sender_role
              };
              return next;
            }

            // Otherwise genuine new message (e.g. from HR Admin)
            return [...prev, {
              id: c.id,
              role: c.sender_role === 'system' ? 'system' : (c.sender_role === 'admin' || c.sender_role === 'ai') ? 'ai' : 'user',
              text: c.content,
              attachment_url: c.attachment_url,
              attachment_type: c.attachment_type,
              progressSteps: [],
              isStreaming: false,
              sender_role: c.sender_role
            }];
          });
        })
        .subscribe();
        
    } else {
      setMessages([
        {
          id: '1',
          role: 'ai',
          text: "Mabuhay! I am your AI Support Assistant. Select a category below to file a ticket, or ask me a question.",
          progressSteps: [],
          isStreaming: false
        }
      ]);
    }
  };
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);

  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [pastTickets, setPastTickets] = useState<any[]>([]);
  
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketDynamic, setTicketDynamic] = useState<any>({});
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Payroll Issue');
  const [formStep, setFormStep] = useState<'category' | 'details' | 'tool_picker'>('category');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date'|'time'>('date');
  const [dateTarget, setDateTarget] = useState('');
  const [dateVal, setDateVal] = useState(new Date());

  // 5-Second Rule UI Presets and Categories
  const CATEGORY_ITEMS = [
    { id: 'Payroll Issue', label: 'Payroll Issue', icon: 'card-outline', color: '#10B981', desc: 'Salary, OT & deductions' },
    { id: 'Equipment Issue', label: 'Equipment Issue', icon: 'construct-outline', color: '#F59E0B', desc: 'Tools, damages & repairs' },
    { id: 'DTR Issue', label: 'DTR / Time', icon: 'time-outline', color: '#6366F1', desc: 'Attendance & clock-in' },
    { id: 'File Leave', label: 'File Leave', icon: 'calendar-outline', color: '#EF4444', desc: 'Sick, vacation & absence' },
    { id: 'Others', label: 'Other Inquiry', icon: 'help-circle-outline', color: '#8B5CF6', desc: 'General reports & inquiries' },
  ];

  interface ToolItem {
    id: string;
    name: string;
    category?: string;
  }

  const FALLBACK_TOOLS: ToolItem[] = [
    { id: 't1', name: 'Makita Cordless Drill #4', category: 'Power Tools' },
    { id: 't2', name: 'Fluke 117 Multimeter', category: 'Diagnostics' },
    { id: 't3', name: 'Robinair 5CFM Vacuum Pump', category: 'HVAC / Refrigeration' },
    { id: 't4', name: 'Digital Manifold Gauge', category: 'HVAC / Refrigeration' },
    { id: 't5', name: 'Bosch Angle Grinder', category: 'Power Tools' },
    { id: 't6', name: 'Yellow Jacket Flaring Tool', category: 'Hand Tools' },
    { id: 't7', name: 'DeWalt 20V Max Hammer Drill', category: 'Power Tools' },
    { id: 't8', name: 'Milwaukee M18 Impact Wrench', category: 'Power Tools' },
    { id: 't9', name: 'Honda EU2200i Generator', category: 'Power Tools' },
  ];

  const [toolsCatalog, setToolsCatalog] = useState<ToolItem[]>(FALLBACK_TOOLS);
  const [toolSearchQuery, setToolSearchQuery] = useState('');

  // Fetch live tool catalog from Supabase
  useEffect(() => {
    async function fetchToolCatalog() {
      try {
        const { data, error } = await supabase
          .from('tool_catalog')
          .select('id, name, category')
          .order('name');
        if (!error && data && data.length > 0) {
          setToolsCatalog(data);
        }
      } catch (err) {
        console.log('Tool catalog fetch fallback to defaults');
      }
    }
    fetchToolCatalog();
  }, []);

  const filteredTools = useMemo(() => {
    if (!toolSearchQuery.trim()) return toolsCatalog;
    const q = toolSearchQuery.toLowerCase();
    return toolsCatalog.filter(
      t => t.name.toLowerCase().includes(q) || (t.category && t.category.toLowerCase().includes(q))
    );
  }, [toolsCatalog, toolSearchQuery]);

  const TOOL_PRESETS = ['Makita Cordless Drill #4', 'Fluke 117 Multimeter', 'Robinair 5CFM Vacuum Pump', 'Digital Manifold Gauge', 'Other Tool'];
  const ISSUE_TYPE_PRESETS = [
    { label: 'Damaged / Broken', value: 'Damaged' },
    { label: 'Malfunctioning', value: 'Malfunctioning' },
    { label: 'Lost / Stolen', value: 'Lost' },
  ];
  const PAYROLL_PRESETS = [
    'Missing Overtime Hours',
    'Incorrect Tax / SSS Deduction',
    'Unpaid Duty / Rest Day',
    'Missing Allowance'
  ];
  const DTR_PRESETS = [
    'Forgot Time-In',
    'Forgot Time-Out',
    'Biometrics Reader Offline',
    'Shift Schedule Mismatch'
  ];
  const LEAVE_TYPES = ['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Unpaid Leave'];

  const isFirstHalf = new Date().getDate() <= 15;
  const currentMonth = new Date().toLocaleString('default', { month: 'short' });
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = prevMonthDate.toLocaleString('default', { month: 'short' });
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  // Hydrate chat input from deep-linked initialQuery
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setInputText(initialQuery);
    }
  }, [initialQuery]);

  // Hydrate formal ticket form from deep-linked initialTicketData
  useEffect(() => {
    if (initialTicketData) {
      setFormStep('details');
      if (initialTicketData.category) {
        setTicketCategory(initialTicketData.category);
      }
      setTicketDynamic((prev: any) => ({
        ...prev,
        logDate: initialTicketData.logDate || prev.logDate || todayStr,
        expectedIn: initialTicketData.expectedIn || prev.expectedIn || '08:00 AM',
        expectedOut: initialTicketData.expectedOut || prev.expectedOut || '05:00 PM',
        recordedIn: initialTicketData.recordedIn,
        recordedOut: initialTicketData.recordedOut,
        totalHours: initialTicketData.totalHours,
        logId: initialTicketData.logId,
      }));
      if (initialTicketData.reason || initialTicketData.logId) {
        const shortId = initialTicketData.logId ? initialTicketData.logId.slice(0, 8) : '';
        const desc = `Dispute for Time Log #${shortId} (${initialTicketData.logDate || ''}). Recorded: ${initialTicketData.recordedIn || ''} - ${initialTicketData.recordedOut || ''} (${initialTicketData.totalHours ? `${initialTicketData.totalHours} hrs` : ''}). Expected: ${initialTicketData.expectedIn || ''} - ${initialTicketData.expectedOut || ''}.`;
        setTicketDesc(desc);
      }
    }
  }, [initialTicketData]);

  const applyCategoryDefaults = (cat: string) => {
    setTicketDynamic((prev: any) => {
      const updated = { ...prev };
      if (cat === 'Payroll Issue') {
        if (!updated.payPeriod) updated.payPeriod = `${isFirstHalf ? '1st - 15th' : '16th - End'} ${currentMonth}`;
      } else if (cat === 'Equipment Issue') {
        if (!updated.toolName) updated.toolName = 'Makita Drill #4';
        if (!updated.issueType) updated.issueType = 'Damaged';
      } else if (cat === 'DTR Issue') {
        if (!updated.logDate) updated.logDate = todayStr;
        if (!updated.expectedIn) updated.expectedIn = '08:00 AM';
        if (!updated.expectedOut) updated.expectedOut = '05:00 PM';
      } else if (cat === 'File Leave') {
        if (!updated.leaveType) updated.leaveType = 'Sick Leave';
        if (!updated.startDate) updated.startDate = tomorrowStr;
        if (!updated.endDate) updated.endDate = tomorrowStr;
      }
      return updated;
    });
  };

  const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<string | undefined>(undefined);

  const openTicketForm = (explicitCategory?: string) => {
    setSelectedCategoryForModal(explicitCategory);
    setTicketModalVisible(true);
  };

  const openHistory = async () => {
    setHistoryModalVisible(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('tickets').select('*').eq('employee_id', session.user.id).order('created_at', { ascending: false });
      if (data) setPastTickets(data);
    }
  };
  
  const flatListRef = useRef<FlatList>(null);
  const formScrollRef = useRef<ScrollView>(null);

  const isImageAttachment = (url?: string | null, type?: string | null) => {
    if (!url) return false;
    if (type && type.startsWith('image/')) return true;
    const clean = url.toLowerCase().split('?')[0];
    return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.webp') || clean.endsWith('.gif');
  };

  const pickChatAttachment = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ 
        type: [
          "image/*",
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel"
        ], 
        copyToCacheDirectory: true 
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        if (!validateAttachment(file)) return;
        setChatAttachment({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream'
        });
      }
    } catch (err: any) {
      Alert.alert("Error", "Failed to select document: " + err.message);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    if (activeTicket && (activeTicket.status === 'closed' || activeTicket.status === 'resolved')) {
      Alert.alert(
        "Ticket Finalized",
        "This ticket has been completed by HR and is now read-only. Please start a new session or submit a new ticket.",
        [
          { text: "Start New Session", onPress: () => loadActiveTicket(true) },
          { text: "OK", style: "cancel" }
        ]
      );
      return;
    }

    const textToSend = (overrideText || inputText).trim();
    if (!textToSend && !chatAttachment) return;

    let localAccumulatedAiText = "";
    const stagedAttachment = chatAttachment;
    const optimisticUserId = Date.now().toString();
    const aiMessageId = (Date.now() + 1).toString();
    setChatAttachment(null);
    setInputText('');
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      let uploadedAttachmentUrl: string | null = null;
      let uploadedAttachmentType: string | null = null;

      if (stagedAttachment && stagedAttachment.uri) {
        setIsUploadingChatAttachment(true);
        try {
          const sanitizedName = stagedAttachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${session.user.id}/${Date.now()}_${sanitizedName}`;
          const payload = await getFilePayload(stagedAttachment.uri);
          const { error: uploadErr } = await supabase.storage
            .from('ticket_attachments')
            .upload(filePath, payload, {
              contentType: stagedAttachment.mimeType || 'application/octet-stream',
              upsert: true
            });

          if (!uploadErr) {
            const { data: publicData } = supabase.storage.from('ticket_attachments').getPublicUrl(filePath);
            uploadedAttachmentUrl = publicData.publicUrl;
            uploadedAttachmentType = stagedAttachment.mimeType || 'application/octet-stream';
          } else {
            console.error("Chat attachment upload error:", uploadErr);
          }
        } catch (uploadErr) {
          console.error("Chat attachment fetch/upload error:", uploadErr);
        } finally {
          setIsUploadingChatAttachment(false);
        }
      }

      const userMessage: Message = {
        id: optimisticUserId,
        role: 'user',
        text: textToSend,
        attachment_url: uploadedAttachmentUrl,
        attachment_type: uploadedAttachmentType,
        attachment: stagedAttachment ? { name: stagedAttachment.name, uri: stagedAttachment.uri } : undefined,
        progressSteps: [],
        isStreaming: false
      };

      setMessages(prev => [...prev, userMessage]);

      const aiMessage: Message = {
        id: aiMessageId,
        role: 'ai',
        text: "",
        progressSteps: [],
        isStreaming: true
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      let currentTicket = activeTicket;
      if (!currentTicket) {
         const { data: newTicket } = await supabase.from('tickets').insert({
            employee_id: session.user.id,
            title: 'Support Conversation',
            category: 'General Inquiry',
            description: textToSend || 'User initiated an AI support chat.',
            status: 'open',
            handling_mode: 'AI',
            attachment_url: uploadedAttachmentUrl,
            attachment_type: uploadedAttachmentType,
            idempotency_key: Crypto.randomUUID()
         }).select().single();
         if (newTicket) {
            currentTicket = newTicket;
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setActiveTicket(newTicket);
            sendRealtimeBroadcast('ticket_update', { ticket_id: newTicket.id });
         }
      }
      if (currentTicket) {
         const { data: insertedComment } = await supabase.from('ticket_comments').insert({
             ticket_id: currentTicket.id,
             sender_role: 'technician',
             content: textToSend || (stagedAttachment ? `Attached: ${stagedAttachment.name}` : ''),
             author_id: session.user.id,
             attachment_url: uploadedAttachmentUrl,
             attachment_type: uploadedAttachmentType
         }).select().single();

         if (insertedComment) {
           setMessages(prev => prev.map(m => m.id === optimisticUserId ? { ...m, id: insertedComment.id } : m));
         }

         sendRealtimeBroadcast('new_comment', { ticket_id: currentTicket.id });
         if (currentTicket.handling_mode === 'ADMIN') {
             setIsTyping(false);
             setMessages(prev => prev.filter(m => m.id !== aiMessageId));
             return;
         }
      }

      // Replace with your actual edge function URL
      const EDGE_FUNCTION_URL = "https://ggknkdyuglzcnkwhvdak.supabase.co/functions/v1/chat-support";

      const chatHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text
      }));

      const es = new EventSource(EDGE_FUNCTION_URL, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ query: userMessage.text, attachment: attachedFile, history: chatHistory }),
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
             localAccumulatedAiText += data.text;
             setMessages(prev => prev.map(m => {
                if (m.id === aiMessageId) {
                  return { ...m, text: m.text + data.text };
                }
                return m;
             }));
          }
          else if (data.type === "rate_limited") {
             es.close();
             setIsTyping(false);
             setMessages(prev => prev.map(m => m.id === aiMessageId ? { 
               ...m, 
               isStreaming: false, 
               text: "The AI service is currently busy. Please try asking your question again in a moment." 
             } : m));
          }
          else if (data.type === "done" || data.type === "error") {
             if (data.type === "error") {
               setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: m.text + "\n\n**Error:** " + data.message, isStreaming: false } : m));
             } else {
               setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, isStreaming: false } : m));
               
               if (currentTicket) {
                  supabase.from('ticket_comments').insert({
                     ticket_id: currentTicket.id,
                     sender_role: 'ai',
                     content: localAccumulatedAiText,
                     author_id: session.user.id
                  }).select().single().then(({ data: insertedAi, error }) => {
                     if (error) console.error("AI Insert Error:", error);
                     if (insertedAi) {
                        setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, id: insertedAi.id } : m));
                      }
                      sendRealtimeBroadcast('new_comment', { ticket_id: currentTicket.id });
                   });
               }
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Support</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={() => loadActiveTicket(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="add-circle-outline" size={24} color={isDark ? colors.brandBlue : BRAND.blue} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openHistory} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="list" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.chatContainer}
          renderItem={({ item }) => {
            if (item.role === 'system') {
              return (
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                  <View style={{ backgroundColor: colors.subCard, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500' }}>{item.text}</Text>
                  </View>
                </View>
              );
            }
            const isUser = item.role === 'user';
            const isAdmin = item.sender_role === 'admin';
            const isApproved = item.text.includes('[TICKET APPROVED');
            const isRefused = item.text.includes('[TICKET REFUSED');
            const isDecision = isApproved || isRefused;
            const isFormalSubmission = isUser && item.text.includes('[FORM SUBMITTED');

            return (
              <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
                {!isUser && (
                  <View style={[
                    styles.avatarAI,
                    isApproved ? { backgroundColor: '#10B981' } :
                    isRefused ? { backgroundColor: '#EF4444' } :
                    isAdmin ? { backgroundColor: '#7C3AED' } :
                    { backgroundColor: BRAND.blue }
                  ]}>
                    <Ionicons 
                      name={
                        isApproved ? "checkmark-circle" :
                        isRefused ? "close-circle" :
                        isAdmin ? "shield-checkmark" :
                        "hardware-chip"
                      } 
                      size={16} 
                      color="#FFF" 
                    />
                  </View>
                )}
                
                <View style={[
                  styles.bubble, 
                  isUser ? styles.bubbleUser : styles.bubbleAI,
                  isApproved && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1.5, borderTopLeftRadius: 4 },
                  isRefused && { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1.5, borderTopLeftRadius: 4 },
                  (isAdmin && !isDecision) && { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF', borderWidth: 1, borderTopLeftRadius: 4 },
                  isFormalSubmission && { borderColor: '#60A5FA', borderWidth: 1.5 }
                ]}>
                    {/* Header Banner for Decision or Formal Messages */}
                    {isApproved && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#A7F3D0' }}>
                        <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 5 }} />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#059669', letterSpacing: 0.5 }}>HR DECISION • APPROVED</Text>
                      </View>
                    )}
                    {isRefused && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#FECACA' }}>
                        <Ionicons name="close-circle" size={14} color="#DC2626" style={{ marginRight: 5 }} />
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#DC2626', letterSpacing: 0.5 }}>HR DECISION • REFUSED</Text>
                      </View>
                    )}
                    {(isAdmin && !isDecision) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#E9D5FF' }}>
                        <Ionicons name="shield-checkmark" size={13} color="#7C3AED" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#7C3AED', letterSpacing: 0.5 }}>HR ADMINISTRATOR</Text>
                      </View>
                    )}
                    {isFormalSubmission && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.25)' }}>
                        <Ionicons name="document-text" size={13} color="#93C5FD" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#93C5FD', letterSpacing: 0.5 }}>FORMAL TICKET SUBMISSION</Text>
                      </View>
                    )}

                    {/* Render User / Comment Attachment if present */}
                    {(item.attachment_url || item.attachment) && (
                      isImageAttachment(item.attachment_url || item.attachment?.uri, item.attachment_type) ? (
                        <TouchableOpacity 
                          activeOpacity={0.88}
                          onPress={() => setLightboxImage(item.attachment_url || item.attachment?.uri || null)}
                          style={{ 
                            marginTop: 4, 
                            marginBottom: item.text ? 8 : 4, 
                            borderRadius: 12, 
                            overflow: 'hidden', 
                            backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                            borderWidth: 1,
                            borderColor: isUser ? 'rgba(255,255,255,0.2)' : '#E2E8F0'
                          }}
                        >
                          <Image 
                            source={{ uri: item.attachment_url || item.attachment?.uri }} 
                            style={{ width: 220, height: 160, borderRadius: 12 }} 
                            resizeMode="cover"
                          />
                          <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="expand" size={11} color="#FFF" style={{ marginRight: 3 }} />
                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>Tap to expand</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => {
                            const target = item.attachment_url || item.attachment?.uri;
                            if (target) Linking.openURL(target).catch(e => Alert.alert("Cannot open file", e.message));
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
                            padding: 8,
                            borderRadius: 8,
                            marginBottom: item.text ? 8 : 4,
                            borderWidth: isUser ? 0 : 1,
                            borderColor: '#E2E8F0'
                          }}
                        >
                          <Ionicons name="document-text" size={16} color={isUser ? "#FFF" : BRAND.blue} style={{ marginRight: 6 }} />
                          <Text style={{ color: isUser ? '#FFF' : '#1E293B', fontSize: 12, flexShrink: 1, fontWeight: '500' }} numberOfLines={1}>
                            {item.attachment?.name || 'Attached Document'}
                          </Text>
                          <Feather name="external-link" size={14} color={isUser ? "#FFF" : "#64748B"} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      )
                    )}

                  {/* Render Progress Steps for AI */}
                  {!isUser && item.progressSteps.length > 0 && item.text.length === 0 && (
                    <View style={styles.progressContainer}>
                      {item.progressSteps.map((step: string, idx: number) => (
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
                      <>
                        <MarkdownText 
                          text={item.text.replace('[ACTION:OPEN_TICKET_FORM]', '')} 
                          style={[
                            styles.messageText, 
                            styles.messageTextAI,
                            isApproved && { color: '#064E3B' },
                            isRefused && { color: '#7F1D1D' },
                            (isAdmin && !isDecision) && { color: '#581C87' }
                          ]} 
                        />
                        {item.text.includes('[ACTION:OPEN_TICKET_FORM]') && (
                            <TouchableOpacity 
                              style={{ marginTop: 12, backgroundColor: BRAND.blue, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                              onPress={() => openTicketForm()}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Open Support / Ticket Form</Text>
                            </TouchableOpacity>
                        )}
                      </>
                    )
                  )}

                </View>
              </View>
            );
          }}
        />

        {/* Quick Suggestion Chips (Only on fresh sessions before an active ticket exists) */}
        {!activeTicket && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.card, flexDirection: 'row' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Report Payroll Issue', 'Report Equipment Issue', 'Report DTR Issue', 'File a Leave', 'Other Inquiry'].map((chip, idx) => (
                <TouchableOpacity key={idx} style={{ backgroundColor: colors.subCard, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: colors.cardBorder }} onPress={() => { 
                  if (chip.includes('Payroll')) openTicketForm('Payroll Issue'); 
                  else if (chip.includes('Equipment')) openTicketForm('Equipment Issue'); 
                  else if (chip.includes('DTR')) openTicketForm('DTR Issue'); 
                  else if (chip.includes('Leave')) openTicketForm('File Leave'); 
                  else if (chip.includes('Other')) openTicketForm('Others');
                }}>
                  <Text style={{ fontSize: 13, color: isDark ? colors.brandBlue : BRAND.blue, fontWeight: '500' }}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Post-Resolution / Post-Refusal Conversation Locking Card */}
        {activeTicket?.status === 'closed' || activeTicket?.status === 'resolved' ? (
          <View style={{ 
            padding: 14, 
            backgroundColor: activeTicket.status === 'resolved' ? (isDark ? '#064E3B' : '#F0FDF4') : (isDark ? '#7F1D1D' : '#FEF2F2'), 
            borderTopWidth: 1, 
            borderColor: activeTicket.status === 'resolved' ? (isDark ? '#047857' : '#BBF7D0') : (isDark ? '#991B1B' : '#FECACA') 
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons 
                name={activeTicket.status === 'resolved' ? "checkmark-circle" : "close-circle"} 
                size={18} 
                color={activeTicket.status === 'resolved' ? "#16A34A" : "#DC2626"} 
                style={{ marginRight: 6 }} 
              />
              <Text style={{ 
                fontWeight: 'bold', 
                fontSize: 13, 
                color: activeTicket.status === 'resolved' ? (isDark ? '#A7F3D0' : '#166534') : (isDark ? '#FECACA' : '#991B1B') 
              }}>
                {activeTicket.status === 'resolved' ? "Ticket Approved & Resolved" : "Request Refused & Closed"}
              </Text>
            </View>

            <Text style={{ 
              fontSize: 12, 
              color: activeTicket.status === 'resolved' ? (isDark ? '#6EE7B7' : "#15803D") : (isDark ? '#FCA5A5' : "#B91C1C"), 
              lineHeight: 16, 
              marginBottom: 10 
            }}>
              {activeTicket.status === 'resolved' 
                ? "This ticket has been completed by HR. The thread is archived as read-only."
                : "HR has finalized this request. You may appeal or open a new ticket with updated details."}
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {activeTicket.status === 'closed' ? (
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: '#DC2626', paddingVertical: 9, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  onPress={() => {
                    loadActiveTicket(true);
                    openTicketForm();
                  }}
                >
                  <Ionicons name="document-text-outline" size={15} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Submit Appeal / New Ticket</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={{ flex: 1, backgroundColor: isDark ? colors.brandBlue : BRAND.blue, paddingVertical: 9, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                  onPress={() => loadActiveTicket(true)}
                >
                  <Ionicons name="add-circle-outline" size={15} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>Start New Support Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.cardBorder }}>
            {chatAttachment && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1E293B' : '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Ionicons name="attach" size={16} color={isDark ? colors.brandBlue : BRAND.blue} style={{ marginRight: 6 }} />
                  <Text style={{ color: isDark ? colors.brandBlue : BRAND.blue, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                    {chatAttachment.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setChatAttachment(null)}>
                  <Feather name="x-circle" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
            {initialTicketData?.logId && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE',
                justifyContent: 'space-between'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <Ionicons name="time" size={16} color="#6366F1" style={{ marginRight: 6 }} />
                  <Text style={{ color: isDark ? '#A5B4FC' : '#4338CA', fontSize: 12, fontFamily: 'DMSans-Medium' }} numberOfLines={1}>
                    Disputing Log #{initialTicketData.logId.slice(0, 8)} ({initialTicketData.logDate || 'Selected Shift'})
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    openTicketForm('DTR Issue');
                  }}
                  style={{
                    backgroundColor: '#6366F1',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 11, fontFamily: 'DMSans-Bold' }}>
                    Open Form
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainer}>
              <TouchableOpacity 
                style={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
                onPress={pickChatAttachment}
                disabled={isUploadingChatAttachment || isTyping}
              >
                <Ionicons name="attach" size={22} color={chatAttachment ? (isDark ? colors.brandBlue : BRAND.blue) : colors.textMuted} />
              </TouchableOpacity>

              <TextInput 
                style={styles.input} 
                placeholder="Ask about procedures, manuals..." 
                value={inputText} 
                onChangeText={setInputText} 
                onSubmitEditing={() => sendMessage()} 
                multiline={true} 
                placeholderTextColor={colors.textSubtle} 
              />
              
              <TouchableOpacity 
                style={[styles.sendBtn, (!inputText.trim() && !chatAttachment) && { opacity: 0.5 }]} 
                onPress={() => sendMessage()}
                disabled={(!inputText.trim() && !chatAttachment) || isTyping || isUploadingChatAttachment}
              >
                {isUploadingChatAttachment ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

      <Modal 
        isVisible={historyModalVisible} 
        onBackdropPress={() => setHistoryModalVisible(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
      >
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '85%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDark ? colors.text : BRAND.blue }}>Ticket History</Text>
            <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={{ backgroundColor: isDark ? colors.brandBlue : BRAND.blue, padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16 }} 
            onPress={() => { setHistoryModalVisible(false); loadActiveTicket(true); }}
          >
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>+ Start New Ticket</Text>
          </TouchableOpacity>
          <FlatList
            data={pastTickets}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Ionicons name="folder-open-outline" size={36} color="#94A3B8" />
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8, fontWeight: '500' }}>No previous tickets found.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isActive = activeTicket?.id === item.id;
              const catColor = getCatColor(item.category);
              const statusBg = item.status === 'resolved' ? (isDark ? '#064E3B' : '#DCFCE7') : item.status === 'open' ? (isDark ? '#78350F' : '#FEF3C7') : (isDark ? '#312E81' : '#E0E7FF');
              const statusTextColor = item.status === 'resolved' ? (isDark ? '#A7F3D0' : '#166534') : item.status === 'open' ? (isDark ? '#FDE68A' : '#92400E') : (isDark ? '#C7D2FE' : '#3730A3');

              return (
                <TouchableOpacity 
                  style={{ 
                    padding: 14, 
                    borderWidth: isActive ? 2 : 1, 
                    borderColor: isActive ? (isDark ? colors.brandBlue : BRAND.blue) : colors.cardBorder, 
                    borderRadius: 12, 
                    marginBottom: 10,
                    backgroundColor: isActive ? colors.subCard : colors.card,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1
                  }}
                  onPress={() => {
                    setHistoryModalVisible(false);
                    loadActiveTicket(false, item.id);
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ backgroundColor: catColor + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: catColor + '30', marginRight: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: catColor }}>{item.category || 'General'}</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: colors.textSubtle, fontWeight: '600' }}>
                        #{item.id.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {isActive && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1E293B' : '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? colors.brandBlue : BRAND.blue, marginRight: 4 }} />
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? colors.brandBlue : BRAND.blue }}>ACTIVE</Text>
                        </View>
                      )}
                      <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: statusTextColor, textTransform: 'uppercase' }}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text, marginBottom: 4 }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 16 }} numberOfLines={2}>
                    {item.description}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
                    <Text style={{ fontSize: 11, color: colors.textSubtle }}>
                      {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: item.handling_mode === 'ADMIN' ? '#7C3AED' : (isDark ? colors.brandBlue : BRAND.blue), marginRight: 2 }}>
                        {item.handling_mode === 'ADMIN' ? 'HR Staff' : 'AI Handled'}
                      </Text>
                      <Feather name="chevron-right" size={12} color={colors.textSubtle} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* Field-First Ticket Submission Modal */}
      <TicketSubmissionModal
        isVisible={ticketModalVisible}
        onClose={() => {
          setTicketModalVisible(false);
          setSelectedCategoryForModal(undefined);
        }}
        activeTicket={activeTicket}
        initialCategory={selectedCategoryForModal}
        initialTicketData={initialTicketData}
        toolsCatalog={toolsCatalog}
        onSubmissionSuccess={(newTicketId) => {
          setTicketModalVisible(false);
          setSelectedCategoryForModal(undefined);
          setTimeout(() => loadActiveTicket(false, newTicketId), 300);
        }}
      />

      {/* Fullscreen Image Lightbox Modal */}
      <Modal
        isVisible={!!lightboxImage}
        onBackdropPress={() => setLightboxImage(null)}
        onBackButtonPress={() => setLightboxImage(null)}
        style={{ margin: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.92)' }}
      >
        <SafeAreaView style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 44, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.25)', padding: 8, borderRadius: 20 }}
            onPress={() => setLightboxImage(null)}
          >
            <Feather name="x" size={22} color="#FFF" />
          </TouchableOpacity>
          {lightboxImage && (
            <Image 
              source={{ uri: lightboxImage }} 
              style={{ width: '92%', height: '78%' }} 
              resizeMode="contain" 
            />
          )}
        </SafeAreaView>
      </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDark ? colors.text : BRAND.blue,
  },
  chatContainer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.bg,
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
    backgroundColor: isDark ? colors.brandBlue : BRAND.blue,
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
    backgroundColor: isDark ? colors.brandBlue : BRAND.blue,
    borderTopRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minWidth: 150,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: colors.subCard,
    padding: 8,
    borderRadius: 8,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textMuted,
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
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 0,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    marginLeft: 12,
    backgroundColor: isDark ? colors.brandBlue : BRAND.blue,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
