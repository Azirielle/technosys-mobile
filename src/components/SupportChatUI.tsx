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
  const [formStep, setFormStep] = useState<'category' | 'details'>('category');
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

  const TOOL_PRESETS = ['Makita Drill #4', 'Fluke Multimeter', 'Bosch Angle Grinder', 'Hilti Rotary Hammer', 'Other Tool'];
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

  const openTicketForm = (explicitCategory?: string) => {
    let targetCategory = explicitCategory;
    
    // Auto-harvest context from recent user messages if category is not explicitly passed
    const userMsgs = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].text : inputText;
    const lower = (lastUserMsg || '').toLowerCase();

    if (!targetCategory) {
      if (/drill|grinder|hammer|multimeter|tool|equipment|machine|broken|damaged|stolen/i.test(lower)) {
        targetCategory = 'Equipment Issue';
      } else if (/payroll|salary|payslip|overtime|\bot\b|deduction|missing pay|wage/i.test(lower)) {
        targetCategory = 'Payroll Issue';
      } else if (/dtr|biometric|time in|time out|clock|attendance|log/i.test(lower)) {
        targetCategory = 'DTR Issue';
      } else if (/leave|vacation|sick|absent|emergency/i.test(lower)) {
        targetCategory = 'File Leave';
      } else {
        targetCategory = 'Others';
      }
    }

    setTicketCategory(targetCategory);
    applyCategoryDefaults(targetCategory);

    // Context Auto-Harvesting: Pre-fill description if empty and there's recent user text
    if (!ticketDesc && lastUserMsg && lastUserMsg.trim() !== '') {
      if (!lastUserMsg.includes('FORM SUBMITTED')) {
        setTicketDesc(lastUserMsg.trim());
        if (targetCategory === 'Others' && !ticketTitle) {
          setTicketTitle(lastUserMsg.slice(0, 40).trim());
        }
      }
    }

    setFormError('');
    setFormStep(explicitCategory ? 'details' : 'category');
    setTicketModalVisible(true);
  };

  const pickModalAttachment = async () => {
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
        setAttachedFile({ uri: file.uri, mimeType: file.mimeType || 'application/octet-stream', name: file.name, size: file.size }); 
      } 
    } catch (err: any) {
      Alert.alert("Error", "Failed to select document: " + err.message);
    }
  };

  const openHistory = async () => {
    setHistoryModalVisible(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase.from('tickets').select('*').eq('employee_id', session.user.id).order('created_at', { ascending: false });
      if (data) setPastTickets(data);
    }
  };
  
  const submitTicket = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    // Generate UUID synchronously
    const currentIdempotencyKey = idempotencyKey || Crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(currentIdempotencyKey);
    if (ticketCategory === 'Payroll Issue' && (!ticketDynamic.payPeriod || !ticketDesc)) {
      setFormError('Please fill in pay period and dispute details.'); setTimeout(() => setFormError(''), 3000);
      setIsSubmitting(false);
      return;
    }
    if (ticketCategory === 'Equipment Issue' && (!ticketDynamic.toolName || !ticketDynamic.issueType || !ticketDesc)) {
      setFormError('Please specify tool, issue type, and details.'); setTimeout(() => setFormError(''), 3000);
      setIsSubmitting(false);
      return;
    }
    if (ticketCategory === 'DTR Issue' && (!ticketDynamic.logDate || !ticketDynamic.expectedIn || !ticketDynamic.expectedOut || !ticketDesc)) {
      setFormError('Please specify date, shift times, and explanation.'); setTimeout(() => setFormError(''), 3000);
      setIsSubmitting(false);
      return;
    }
    if (ticketCategory === 'File Leave') {
      if (!ticketDynamic.leaveType || !ticketDynamic.startDate || !ticketDynamic.endDate || !ticketDesc.trim()) {
        setFormError('Please select leave type, dates, and reason.'); setTimeout(() => setFormError(''), 3000);
        setIsSubmitting(false);
        return;
      }
      if (ticketDynamic.endDate < ticketDynamic.startDate) {
        setFormError('End date cannot be earlier than start date.'); setTimeout(() => setFormError(''), 3000);
        setIsSubmitting(false);
        return;
      }
      if (ticketDynamic.leaveType === 'Vacation Leave' && ticketDynamic.startDate < todayStr) {
        setFormError('Vacation leaves must be scheduled in advance.'); setTimeout(() => setFormError(''), 3000);
        setIsSubmitting(false);
        return;
      }
    }
    if (ticketCategory === 'Others' && (!ticketTitle.trim() || !ticketDesc.trim())) {
      setFormError('Please enter both subject and description.'); setTimeout(() => setFormError(''), 3000);
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsSubmitting(false);
        return;
      }

      // --- Anti-Spam Guard: Check for duplicate open tickets ---
      if (!activeTicket) {
        const { data: openTickets } = await supabase
          .from('tickets')
          .select('id, title, category, description, created_at')
          .eq('employee_id', session.user.id)
          .eq('status', 'open')
          .eq('category', ticketCategory);

        if (openTickets && openTickets.length > 0) {
          let conflictTicket: any = null;

          if (ticketCategory === 'DTR Issue' && ticketDynamic.logDate) {
            conflictTicket = openTickets.find(t => 
              (t.description && t.description.includes(ticketDynamic.logDate)) ||
              (t.title && t.title.includes(ticketDynamic.logDate))
            );
          } else if (ticketCategory === 'Payroll Issue' && ticketDynamic.payPeriod) {
            conflictTicket = openTickets.find(t => 
              (t.description && t.description.includes(ticketDynamic.payPeriod)) ||
              (t.title && t.title.includes(ticketDynamic.payPeriod))
            );
          } else if (ticketCategory === 'File Leave' && ticketDynamic.startDate) {
            conflictTicket = openTickets.find(t => 
              (t.description && t.description.includes(ticketDynamic.startDate)) ||
              (t.title && t.title.includes(ticketDynamic.startDate))
            );
          }

          if (conflictTicket) {
            setIsSubmitting(false);
            Alert.alert(
              "Active Request in Progress",
              `You already have an open ticket (#${conflictTicket.id.slice(0, 8).toUpperCase()}) for this ${ticketCategory === 'Payroll Issue' ? 'pay period' : 'date'}. An HR coordinator is reviewing it. Would you like to view that thread?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Open Existing Ticket",
                  onPress: () => {
                    setTicketModalVisible(false);
                    loadActiveTicket(false, conflictTicket.id);
                  }
                }
              ]
            );
            return;
          }
        }
      }
      
      let uploadedUrl = null;
      let uploadedType = null;
      if (attachedFile && attachedFile.uri) {
        const sanitizedName = attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${session.user.id}/${Date.now()}_${sanitizedName}`;
        const payload = await getFilePayload(attachedFile.uri);
        
        const { error: uploadError } = await supabase.storage.from('ticket_attachments').upload(filePath, payload, {
          contentType: attachedFile.mimeType || 'application/octet-stream',
          upsert: true
        });
        
        if (!uploadError) {
          const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(filePath);
          uploadedUrl = data.publicUrl;
          uploadedType = attachedFile.mimeType || 'application/octet-stream';
        } else {
          console.error("Form attachment upload error:", uploadError);
        }
      }

      // Construct dynamic description
      let finalTitle = ticketTitle;
      let finalDesc = ticketDesc;
      
      if (ticketCategory === 'Payroll Issue') {
         finalTitle = `Payroll Concern: ${ticketDynamic.payPeriod || 'Current Cutoff'}`;
         finalDesc = `Pay Period: ${ticketDynamic.payPeriod}\nDetails: ${ticketDesc}`;
      } else if (ticketCategory === 'Equipment Issue') {
         const finalTool = ticketDynamic.toolName === 'Other Tool' ? (ticketDynamic.customTool || 'Other Equipment') : (ticketDynamic.toolName || 'Unknown Tool');
         finalTitle = `Equipment: ${finalTool}`;
         finalDesc = `Tool / Item: ${finalTool}\nReported Condition: ${ticketDynamic.issueType}\nNotes: ${ticketDesc}`;
      } else if (ticketCategory === 'DTR Issue') {
         finalTitle = `DTR Adjustment: ${ticketDynamic.logDate || 'Selected Shift'}`;
         finalDesc = `Target Shift: ${ticketDynamic.logDate}\nRequested Times: In at ${ticketDynamic.expectedIn}, Out at ${ticketDynamic.expectedOut}\nExplanation: ${ticketDesc}`;
      } else if (ticketCategory === 'File Leave') {
         finalTitle = `Leave Filing: ${ticketDynamic.leaveType || 'General'}`;
         finalDesc = `Leave Type: ${ticketDynamic.leaveType}\nRequested Schedule: ${ticketDynamic.startDate} to ${ticketDynamic.endDate}\nReason: ${ticketDesc}`;
      } else if (ticketCategory === 'Others') {
         finalTitle = ticketTitle.trim();
         finalDesc = ticketDesc.trim();
      }

      let error;
      let newTicket = activeTicket;
      
      if (activeTicket) {
        // UPDATE existing ticket instead of creating new
        const { error: updateError } = await supabase.from('tickets').update({
          title: finalTitle,
          category: ticketCategory,
          description: finalDesc,
          attachment_url: uploadedUrl || activeTicket.attachment_url,
          attachment_type: uploadedType || activeTicket.attachment_type,
          status: 'open',
        }).eq('id', activeTicket.id);
        error = updateError;
        sendRealtimeBroadcast('ticket_update', { ticket_id: activeTicket.id });
      } else {
        // CREATE new ticket if none exists
        const res = await supabase.from('tickets').insert({
          employee_id: session.user.id,
          title: finalTitle,
          category: ticketCategory,
          description: finalDesc,
          attachment_url: uploadedUrl,
          attachment_type: uploadedType,
          status: 'open',
          idempotency_key: currentIdempotencyKey,
        }).select().single();
        error = res.error;
        newTicket = res.data;
        if (newTicket) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setActiveTicket(newTicket);
          sendRealtimeBroadcast('ticket_update', { ticket_id: newTicket.id });
        }
      }

      if (error) {
          if (error.code === '23505') {
            console.log('Idempotency prevented duplicate');
            setIsSubmitting(false);
            setTicketModalVisible(false);
            setFormStep('category');
            setTimeout(() => loadActiveTicket(), 1000);
            return;
          }
          throw error;
      }

      const ticketId = activeTicket ? activeTicket.id : newTicket?.id;
      if (ticketId) {
        const submissionContent = `📋 Form Submitted: ${ticketCategory}\nSubject: ${finalTitle}\n\n${finalDesc}`;
          
        await supabase.from('ticket_comments').insert({
          ticket_id: ticketId,
          sender_role: 'technician',
          content: submissionContent,
          author_id: session.user.id,
          attachment_url: uploadedUrl,
          attachment_type: uploadedType
        });

        await supabase.from('ticket_comments').insert({
          ticket_id: ticketId,
          sender_role: 'ai',
          content: `✅ Your ${ticketCategory} request has been submitted to HR (Reference #${ticketId.slice(0, 8).toUpperCase()}).\n\nAn HR coordinator has been notified and will review your details. Any updates or decisions will appear directly in this chat thread.`,
          author_id: session.user.id
        });

        sendRealtimeBroadcast('ticket_update', { ticket_id: ticketId });
        sendRealtimeBroadcast('new_comment', { ticket_id: ticketId });
      }

      setTicketModalVisible(false);
      setFormStep('category');
      setTicketTitle('');
      setTicketDesc('');
      setAttachedFile(null);
      setIsSubmitting(false);

      // Reload to connect the channel and display the newly inserted comments
      setTimeout(() => loadActiveTicket(false, ticketId), 300);
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert("Error", err.message);
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
                    setTicketCategory('DTR Issue');
                    setTicketModalVisible(true);
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

      <Modal 
        isVisible={ticketModalVisible} 
        onBackdropPress={() => {
          setTicketModalVisible(false);
          setFormStep('category');
        }}
        onBackButtonPress={() => {
          if (formStep === 'details') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFormStep('category');
          } else {
            setTicketModalVisible(false);
          }
        }}
        onSwipeComplete={() => {
          setTicketModalVisible(false);
          setFormStep('category');
        }}
        swipeDirection={['down']} 
        propagateSwipe={true}
        swipeThreshold={50}
        style={{ justifyContent: 'flex-end', margin: 0 }}
      >
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16, maxHeight: '90%', flex: 1 }}>
          {/* Sheet Drag Handle */}
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.cardBorder, alignSelf: 'center', marginBottom: 14 }} />

          {formStep === 'category' ? (
            /* =========================================================================
               SCREEN 1 (THE HOOK): ZERO COGNITIVE OVERLOAD, SINGLE TAP DECISION
               ========================================================================= */
            <>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Report an Issue</Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>What do you need help with today?</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setTicketModalVisible(false)} 
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.subCard : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* 5 Big Tactile Action Cards (GoTyme Aesthetic) */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <View style={{ gap: 10 }}>
                  {CATEGORY_ITEMS.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setTicketCategory(cat.id);
                        applyCategoryDefaults(cat.id);
                        setFormStep('details');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDark ? colors.subCard : '#F8FAFC',
                        borderRadius: 16,
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        borderWidth: 1,
                        borderColor: isDark ? colors.cardBorder : '#E2E8F0',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: isDark ? 0.2 : 0.04,
                        shadowRadius: 4,
                        elevation: 2,
                      }}
                    >
                      <View style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: isDark ? cat.color + '25' : cat.color + '18',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                      }}>
                        <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                          {cat.label}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                          {cat.desc}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : (
            /* =========================================================================
               SCREEN 2 (THE DETAILS): CONVERSATIONAL MICROCOPY & 1-TAP PRESETS
               ========================================================================= */
            <>
              {/* Top Navigation Bar */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setFormStep('category');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="arrow-left" size={18} color={colors.brandBlue} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brandBlue }}>Categories</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? getCatColor(ticketCategory) + '25' : getCatColor(ticketCategory) + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 }}>
                  <Ionicons 
                    name={
                      ticketCategory === 'Payroll Issue' ? 'cash' :
                      ticketCategory === 'Equipment Issue' ? 'construct' :
                      ticketCategory === 'DTR Issue' ? 'time' :
                      ticketCategory === 'File Leave' ? 'calendar' : 'chatbubbles'
                    } 
                    size={14} 
                    color={getCatColor(ticketCategory)} 
                    style={{ marginRight: 5 }} 
                  />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: getCatColor(ticketCategory) }}>
                    {CATEGORY_ITEMS.find(c => c.id === ticketCategory)?.label || ticketCategory}
                  </Text>
                </View>

                <TouchableOpacity 
                  onPress={() => {
                    setTicketModalVisible(false);
                    setFormStep('category');
                  }} 
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Form Body */}
              <ScrollView ref={formScrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Date Time Picker Modal */}
                {showDatePicker && (
                  <DateTimePicker
                    value={dateVal}
                    mode={pickerMode}
                    display="default"
                    minimumDate={
                      pickerMode === 'time'
                        ? undefined
                        : ticketCategory === 'File Leave'
                        ? (ticketDynamic.leaveType === 'Vacation Leave'
                            ? new Date()
                            : new Date(Date.now() - 3 * 86400000))
                        : undefined
                    }
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        const formatted = pickerMode === 'time' 
                          ? selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : selectedDate.toISOString().split('T')[0];
                        setTicketDynamic((prev: any) => {
                          const next = { ...prev, [dateTarget]: formatted };
                          if (dateTarget === 'startDate' && prev.endDate && prev.endDate < formatted) {
                            next.endDate = formatted;
                          }
                          return next;
                        });
                      }
                    }}
                  />
                )}

                {/* Sub-form 1: Payroll Issue */}
                {ticketCategory === 'Payroll Issue' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Which cutoff is affected?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {[
                          `${isFirstHalf ? '1st - 15th' : '16th - End'} ${currentMonth}`,
                          `${isFirstHalf ? '16th - End' : '1st - 15th'} ${isFirstHalf ? prevMonth : currentMonth}`,
                          'Custom Date...'
                        ].map((preset, idx) => {
                          const isSelected = ticketDynamic.payPeriod === preset || (idx === 2 && ticketDynamic.payPeriod && !preset.includes(ticketDynamic.payPeriod));
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (idx === 2) {
                                  setDateTarget('payPeriod');
                                  setDateVal(new Date());
                                  setPickerMode('date');
                                  setShowDatePicker(true);
                                } else {
                                  setTicketDynamic((prev: any) => ({ ...prev, payPeriod: preset }));
                                }
                              }}
                              style={{
                                minHeight: 38,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 10,
                                borderWidth: isSelected ? 1.5 : 1,
                                borderColor: isSelected ? '#10B981' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5') : (isDark ? colors.subCard : '#FFF'),
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#059669' : colors.text }}>
                                {idx === 2 && ticketDynamic.payPeriod && !ticketDynamic.payPeriod.includes('Cutoff') && !ticketDynamic.payPeriod.includes(currentMonth) ? ticketDynamic.payPeriod : preset}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>What seems to be missing?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {PAYROLL_PRESETS.map((chip, idx) => {
                          const isChipSelected = ticketDesc.includes(chip);
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                setTicketDesc((prev: string) => prev.trim() ? (prev.includes(chip) ? prev : `${prev}, ${chip}`) : chip);
                              }}
                              style={{
                                minHeight: 36,
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 8,
                                backgroundColor: isChipSelected ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5') : (isDark ? colors.subCard : '#FFF'),
                                borderWidth: isChipSelected ? 1.5 : 1,
                                borderColor: isChipSelected ? '#10B981' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isChipSelected ? '700' : '500', color: isChipSelected ? '#047857' : colors.text }}>
                                + {chip}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Describe what happened</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 12, padding: 12, height: 85, textAlignVertical: 'top', backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        value={ticketDesc}
                        onChangeText={setTicketDesc}
                        multiline
                        placeholder="e.g. Worked 4 hours approved OT on Friday but didn't reflect on my payslip..."
                        placeholderTextColor={colors.textSubtle}
                      />
                    </View>
                  </View>
                )}

                {/* Sub-form 2: Equipment Issue */}
                {ticketCategory === 'Equipment Issue' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Which tool or gear?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {TOOL_PRESETS.map((tool, idx) => {
                          const isSelected = ticketDynamic.toolName === tool;
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => setTicketDynamic((prev: any) => ({ ...prev, toolName: tool }))}
                              style={{
                                minHeight: 38,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 10,
                                borderWidth: isSelected ? 1.5 : 1,
                                borderColor: isSelected ? '#F59E0B' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7') : (isDark ? colors.subCard : '#FFF'),
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#B45309' : colors.text }}>
                                {tool}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {ticketDynamic.toolName === 'Other Tool' && (
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 10, padding: 10, backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        placeholder="Type tool name or serial ID..."
                        placeholderTextColor={colors.textSubtle}
                        value={ticketDynamic.customTool || ''}
                        onChangeText={(val) => setTicketDynamic((prev: any) => ({ ...prev, customTool: val }))}
                      />
                    )}

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>What happened to the tool?</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {ISSUE_TYPE_PRESETS.map((item, idx) => {
                          const isSelected = ticketDynamic.issueType === item.value;
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => setTicketDynamic((prev: any) => ({ ...prev, issueType: item.value }))}
                              style={{
                                flex: 1,
                                minHeight: 40,
                                borderRadius: 10,
                                borderWidth: isSelected ? 1.5 : 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderColor: isSelected ? '#F59E0B' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7') : (isDark ? colors.subCard : '#FFF'),
                                paddingHorizontal: 4,
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#B45309' : colors.text, textAlign: 'center' }}>
                                {item.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Describe the defect or damage</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 12, padding: 12, height: 85, textAlignVertical: 'top', backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        value={ticketDesc}
                        onChangeText={setTicketDesc}
                        multiline
                        placeholder="e.g. Chuck stuck while drilling, motor smells like burning smoke on 3rd floor..."
                        placeholderTextColor={colors.textSubtle}
                      />
                    </View>
                  </View>
                )}

                {/* Sub-form 3: DTR Issue */}
                {ticketCategory === 'DTR Issue' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Which date was affected?</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                          { label: 'Today', val: todayStr },
                          { label: 'Yesterday', val: yesterdayStr },
                          { label: 'Pick Date...', val: 'custom' }
                        ].map((item, idx) => {
                          const isSelected = ticketDynamic.logDate === item.val || (item.val === 'custom' && ticketDynamic.logDate && ticketDynamic.logDate !== todayStr && ticketDynamic.logDate !== yesterdayStr);
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                if (item.val === 'custom') {
                                  setDateTarget('logDate');
                                  setDateVal(new Date());
                                  setPickerMode('date');
                                  setShowDatePicker(true);
                                } else {
                                  setTicketDynamic((prev: any) => ({ ...prev, logDate: item.val }));
                                }
                              }}
                              style={{
                                flex: 1,
                                minHeight: 38,
                                borderRadius: 10,
                                borderWidth: isSelected ? 1.5 : 1,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderColor: isSelected ? '#6366F1' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#EEF2FF') : (isDark ? colors.subCard : '#FFF')
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#4338CA' : colors.text }}>
                                {item.val === 'custom' && ticketDynamic.logDate && ticketDynamic.logDate !== todayStr && ticketDynamic.logDate !== yesterdayStr ? ticketDynamic.logDate : item.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>What happened with your log?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {DTR_PRESETS.map((preset, idx) => {
                          const isChipSelected = ticketDesc.includes(preset);
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => {
                                setTicketDesc((prev: string) => prev.trim() ? (prev.includes(preset) ? prev : `${prev}, ${preset}`) : preset);
                              }}
                              style={{
                                minHeight: 36,
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 8,
                                backgroundColor: isChipSelected ? (isDark ? 'rgba(99, 102, 241, 0.2)' : '#E0E7FF') : (isDark ? colors.subCard : '#FFF'),
                                borderWidth: isChipSelected ? 1.5 : 1,
                                borderColor: isChipSelected ? '#6366F1' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isChipSelected ? '700' : '500', color: isChipSelected ? '#3730A3' : colors.text }}>
                                + {preset}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Actual Time In</Text>
                        <TouchableOpacity
                          onPress={() => { setDateTarget('expectedIn'); setDateVal(new Date()); setPickerMode('time'); setShowDatePicker(true); }}
                          style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 10, padding: 12, backgroundColor: isDark ? colors.subCard : '#FFF', alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 14, color: ticketDynamic.expectedIn ? colors.text : colors.textSubtle, fontWeight: '700' }}>
                            {ticketDynamic.expectedIn || '08:00 AM'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Actual Time Out</Text>
                        <TouchableOpacity
                          onPress={() => { setDateTarget('expectedOut'); setDateVal(new Date()); setPickerMode('time'); setShowDatePicker(true); }}
                          style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 10, padding: 12, backgroundColor: isDark ? colors.subCard : '#FFF', alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 14, color: ticketDynamic.expectedOut ? colors.text : colors.textSubtle, fontWeight: '700' }}>
                            {ticketDynamic.expectedOut || '05:00 PM'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Additional details (Optional)</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 12, padding: 12, height: 80, textAlignVertical: 'top', backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        value={ticketDesc}
                        onChangeText={setTicketDesc}
                        multiline
                        placeholder="e.g. Biometrics had no power when I arrived on site at 7:55 AM..."
                        placeholderTextColor={colors.textSubtle}
                      />
                    </View>
                  </View>
                )}

                {/* Sub-form 4: File Leave */}
                {ticketCategory === 'File Leave' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>What type of leave?</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {LEAVE_TYPES.map((leave, idx) => {
                          const isSelected = ticketDynamic.leaveType === leave;
                          return (
                            <TouchableOpacity
                              key={idx}
                              activeOpacity={0.7}
                              onPress={() => setTicketDynamic((prev: any) => ({ ...prev, leaveType: leave }))}
                              style={{
                                minHeight: 38,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 10,
                                borderWidth: isSelected ? 1.5 : 1,
                                borderColor: isSelected ? '#EF4444' : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') : (isDark ? colors.subCard : '#FFF'),
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#B91C1C' : colors.text }}>
                                {leave}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Start Date</Text>
                        <TouchableOpacity
                          onPress={() => { setDateTarget('startDate'); setDateVal(new Date()); setPickerMode('date'); setShowDatePicker(true); }}
                          style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 10, padding: 12, backgroundColor: isDark ? colors.subCard : '#FFF', alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 13, color: ticketDynamic.startDate ? colors.text : colors.textSubtle, fontWeight: '700' }}>
                            {ticketDynamic.startDate || tomorrowStr}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>End Date</Text>
                        <TouchableOpacity
                          onPress={() => { setDateTarget('endDate'); setDateVal(new Date()); setPickerMode('date'); setShowDatePicker(true); }}
                          style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 10, padding: 12, backgroundColor: isDark ? colors.subCard : '#FFF', alignItems: 'center' }}
                        >
                          <Text style={{ fontSize: 13, color: ticketDynamic.endDate ? colors.text : colors.textSubtle, fontWeight: '700' }}>
                            {ticketDynamic.endDate || tomorrowStr}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Reason for leave</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 12, padding: 12, height: 80, textAlignVertical: 'top', backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        value={ticketDesc}
                        onChangeText={setTicketDesc}
                        multiline
                        placeholder="e.g. Sudden high fever, need 2 days bed rest as per doctor..."
                        placeholderTextColor={colors.textSubtle}
                      />
                    </View>
                  </View>
                )}

                {/* Sub-form 5: Others */}
                {ticketCategory === 'Others' && (
                  <View style={{ gap: 14 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Subject / Concern</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 10, padding: 12, backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        value={ticketTitle}
                        onChangeText={setTicketTitle}
                        placeholder="e.g. Request for Certificate of Employment (COE)..."
                        placeholderTextColor={colors.textSubtle}
                      />
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 }}>Explain your inquiry</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#CBD5E1', borderRadius: 12, padding: 12, height: 90, textAlignVertical: 'top', backgroundColor: isDark ? colors.subCard : '#FFF', fontSize: 14, color: colors.text }}
                        value={ticketDesc}
                        onChangeText={setTicketDesc}
                        multiline
                        placeholder="e.g. Need COE for bank loan verification by next Wednesday..."
                        placeholderTextColor={colors.textSubtle}
                      />
                    </View>
                  </View>
                )}

                {/* Attachment Upload Card */}
                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Proof / Attachment (Optional)</Text>
                  {attachedFile ? (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4',
                      borderWidth: 1,
                      borderColor: isDark ? '#059669' : '#86EFAC',
                      borderRadius: 14,
                      padding: 12,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                          <Ionicons name="document-attach" size={20} color="#16A34A" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#A7F3D0' : '#166534' }} numberOfLines={1}>
                            {attachedFile.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: isDark ? '#6EE7B7' : '#15803D' }}>Ready for upload • 1 file attached</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => setAttachedFile(null)} style={{ padding: 6 }}>
                        <Feather name="trash-2" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={pickModalAttachment}
                      style={{
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                        borderRadius: 14,
                        backgroundColor: isDark ? colors.subCard : '#F8FAFC',
                        paddingVertical: 14,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? colors.card : '#EEF2F6', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Feather name="paperclip" size={18} color={colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Attach photo or file (Optional)</Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>Images, PDF, Docx (Max 5MB)</Text>
                      </View>
                      <Feather name="upload-cloud" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Error Message */}
                {formError ? (
                  <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', padding: 12, borderRadius: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700', flex: 1 }}>{formError}</Text>
                  </View>
                ) : null}
              </ScrollView>

              {/* Sticky Thumb-Zone Action Bar */}
              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.cardBorder, backgroundColor: colors.card }}>
                <TouchableOpacity 
                  disabled={isSubmitting} 
                  activeOpacity={0.85}
                  style={{ 
                    backgroundColor: isSubmitting ? '#94A3B8' : getCatColor(ticketCategory), 
                    paddingVertical: 15, 
                    borderRadius: 16, 
                    alignItems: 'center', 
                    flexDirection: 'row', 
                    justifyContent: 'center', 
                    shadowColor: getCatColor(ticketCategory),
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4
                  }} 
                  onPress={submitTicket}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Submitting Request...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>
                        Send Request to HR
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

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
