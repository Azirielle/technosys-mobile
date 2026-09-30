import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  UIManager,
  StyleSheet
} from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons, Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../hooks/use-theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ToolItem {
  id: string;
  name: string;
  category?: string;
}

export interface TicketSubmissionModalProps {
  isVisible: boolean;
  onClose: () => void;
  activeTicket: any;
  initialCategory?: string;
  initialTicketData?: any;
  toolsCatalog: ToolItem[];
  onSubmissionSuccess: (ticketId: string) => void;
}

const BRAND_BLUE = '#1E3A8A';

export default function TicketSubmissionModal({
  isVisible,
  onClose,
  activeTicket,
  initialCategory,
  initialTicketData,
  toolsCatalog,
  onSubmissionSuccess,
}: TicketSubmissionModalProps) {
  const { colors, isDark } = useAppTheme();

  // Navigation step: 'category' (screen 1) | 'details' (screen 2) | 'tool_picker' (modal picker)
  const [formStep, setFormStep] = useState<'category' | 'details' | 'tool_picker'>('category');
  const [ticketCategory, setTicketCategory] = useState<string>('Payroll Issue');

  // Form Fields
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketDynamic, setTicketDynamic] = useState<any>({});
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  // Tool Catalog Picker State
  const [toolSearchQuery, setToolSearchQuery] = useState('');

  // Date/Time Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [dateTarget, setDateTarget] = useState('');
  const [dateVal, setDateVal] = useState(new Date());

  const scrollRef = useRef<ScrollView>(null);

  // Date Presets & Helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const isFirstHalf = useMemo(() => new Date().getDate() <= 15, []);
  const currentMonth = useMemo(() => new Date().toLocaleString('default', { month: 'short' }), []);
  const prevMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleString('default', { month: 'short' });
  }, []);

  const CATEGORY_ITEMS = [
    { id: 'Payroll Issue', label: 'Payroll Issue', icon: 'card-outline', color: '#10B981', desc: 'Salary, OT & deductions' },
    { id: 'Equipment Issue', label: 'Equipment Issue', icon: 'construct-outline', color: '#F59E0B', desc: 'Tools, damages & repairs' },
    { id: 'DTR Issue', label: 'DTR / Time', icon: 'time-outline', color: '#6366F1', desc: 'Attendance & clock-in' },
    { id: 'File Leave', label: 'File Leave', icon: 'calendar-outline', color: '#3B82F6', desc: 'Sick, vacation & absence' },
    { id: 'Others', label: 'Other Inquiry', icon: 'help-circle-outline', color: '#8B5CF6', desc: 'General reports & inquiries' },
  ];

  const PAYROLL_DISCREPANCY_OPTIONS = [
    'Missing Overtime Hours',
    'Missing Allowance / Differential',
    'Incorrect Tax / SSS / PhilHealth',
    'Unpaid Rest Day / Holiday Pay',
  ];

  const DTR_DISCREPANCY_OPTIONS = [
    'Forgot Time-In',
    'Forgot Time-Out',
    'Biometrics Reader Offline',
    'Shift Schedule Mismatch',
  ];

  const LEAVE_TYPES = [
    { label: 'Vacation Leave', desc: 'Scheduled rest / personal' },
    { label: 'Sick Leave', desc: 'Illness / medical recovery' },
    { label: 'Emergency Leave', desc: 'Urgent family / personal matter' },
    { label: 'Unpaid Leave', desc: 'Approved unpaid absence' },
  ];

  const ISSUE_TYPES = [
    { label: 'Damaged / Broken', value: 'Damaged', icon: 'alert-circle-outline', color: '#EF4444' },
    { label: 'Malfunctioning', value: 'Malfunctioning', icon: 'warning-outline', color: '#F59E0B' },
    { label: 'Lost / Stolen', value: 'Lost', icon: 'help-circle-outline', color: '#64748B' },
  ];

  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.docx', '.doc', '.xlsx', '.xls'];
  const ALLOWED_MIME_TYPES = [
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  // Reset or hydrate on modal open
  useEffect(() => {
    if (isVisible) {
      setFormError('');
      setIsSubmitting(false);
      setIdempotencyKey(Crypto.randomUUID());

      if (initialTicketData) {
        setFormStep('details');
        const cat = initialTicketData.category || initialCategory || 'DTR Issue';
        setTicketCategory(cat);
        setTicketDynamic({
          logDate: initialTicketData.logDate || todayStr,
          expectedIn: initialTicketData.expectedIn || '08:00 AM',
          expectedOut: initialTicketData.expectedOut || '05:00 PM',
          recordedIn: initialTicketData.recordedIn,
          recordedOut: initialTicketData.recordedOut,
          totalHours: initialTicketData.totalHours,
          logId: initialTicketData.logId,
          discrepancyType: 'Forgot Time-In',
        });
        if (initialTicketData.reason || initialTicketData.logId) {
          const shortId = initialTicketData.logId ? initialTicketData.logId.slice(0, 8) : '';
          setTicketDesc(`Dispute for Time Log #${shortId} (${initialTicketData.logDate || ''}). Recorded: ${initialTicketData.recordedIn || ''} - ${initialTicketData.recordedOut || ''}. Expected: ${initialTicketData.expectedIn || ''} - ${initialTicketData.expectedOut || ''}.`);
        } else {
          setTicketDesc('');
        }
      } else if (initialCategory) {
        setTicketCategory(initialCategory);
        applyCategoryDefaults(initialCategory);
        setTicketTitle('');
        setTicketDesc('');
        setAttachedFile(null);
        setFormStep('details');
      } else {
        setFormStep('category');
        setTicketTitle('');
        setTicketDesc('');
        setTicketDynamic({});
        setAttachedFile(null);
      }
    }
  }, [isVisible, initialCategory, initialTicketData]);

  const applyCategoryDefaults = (cat: string) => {
    const currentPayPreset = `${isFirstHalf ? '1st - 15th' : '16th - End'} ${currentMonth}`;
    if (cat === 'Payroll Issue') {
      setTicketDynamic({
        payPeriod: currentPayPreset,
        discrepancyType: 'Missing Overtime Hours'
      });
    } else if (cat === 'Equipment Issue') {
      setTicketDynamic({
        toolName: toolsCatalog.length > 0 ? toolsCatalog[0].name : '',
        customTool: '',
        issueType: 'Damaged'
      });
    } else if (cat === 'DTR Issue') {
      setTicketDynamic({
        logDate: todayStr,
        discrepancyType: 'Forgot Time-In',
        expectedIn: '08:00 AM',
        expectedOut: '05:00 PM'
      });
    } else if (cat === 'File Leave') {
      setTicketDynamic({
        leaveType: 'Vacation Leave',
        startDate: tomorrowStr,
        endDate: tomorrowStr
      });
    } else {
      setTicketDynamic({});
    }
  };

  const selectCategory = (catId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTicketCategory(catId);
    applyCategoryDefaults(catId);
    setTicketTitle('');
    setTicketDesc('');
    setAttachedFile(null);
    setFormStep('details');
  };

  // Filtered tools
  const filteredTools = useMemo(() => {
    if (!toolSearchQuery.trim()) return toolsCatalog;
    const q = toolSearchQuery.toLowerCase();
    return toolsCatalog.filter(
      t => t.name.toLowerCase().includes(q) || (t.category && t.category.toLowerCase().includes(q))
    );
  }, [toolsCatalog, toolSearchQuery]);

  // Leave duration helper
  const leaveDurationDays = useMemo(() => {
    if (ticketCategory !== 'File Leave' || !ticketDynamic.startDate || !ticketDynamic.endDate) return 1;
    const start = new Date(ticketDynamic.startDate);
    const end = new Date(ticketDynamic.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [ticketCategory, ticketDynamic.startDate, ticketDynamic.endDate]);

  // File picker
  const pickAttachment = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ],
        copyToCacheDirectory: true
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        const isExtValid = ALLOWED_EXTENSIONS.includes(ext);
        const isMimeValid = file.mimeType ? (
          ALLOWED_MIME_TYPES.includes(file.mimeType.toLowerCase()) || file.mimeType.startsWith('image/')
        ) : isExtValid;

        if (!isExtValid && !isMimeValid) {
          Alert.alert('Unsupported File', 'Please attach an image, PDF, or document.');
          return;
        }

        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Attachments must be under 5MB.');
          return;
        }

        setAttachedFile({ uri: file.uri, mimeType: file.mimeType || 'application/octet-stream', name: file.name, size: file.size });
      }
    } catch (err: any) {
      Alert.alert('Upload Error', 'Could not select file: ' + err.message);
    }
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
      return bytes.buffer;
    } catch (e) {
      console.error('File payload error:', e);
      return null;
    }
  };

  // Submission handler
  const handleSubmit = async () => {
    setFormError('');
    setIsSubmitting(true);

    // Validation
    if (ticketCategory === 'Payroll Issue') {
      if (!ticketDynamic.payPeriod || !ticketDesc.trim()) {
        setFormError('Please specify the pay cutoff and describe the missing items.');
        setIsSubmitting(false);
        return;
      }
    } else if (ticketCategory === 'Equipment Issue') {
      const toolName = ticketDynamic.toolName === 'Other Tool' ? ticketDynamic.customTool : ticketDynamic.toolName;
      if (!toolName || !ticketDynamic.issueType || !ticketDesc.trim()) {
        setFormError('Please specify the tool, issue type, and describe the defect.');
        setIsSubmitting(false);
        return;
      }
    } else if (ticketCategory === 'DTR Issue') {
      if (!ticketDynamic.logDate || !ticketDynamic.expectedIn || !ticketDynamic.expectedOut || !ticketDesc.trim()) {
        setFormError('Please provide shift date, accurate in/out times, and explanation.');
        setIsSubmitting(false);
        return;
      }
    } else if (ticketCategory === 'File Leave') {
      if (!ticketDynamic.leaveType || !ticketDynamic.startDate || !ticketDynamic.endDate || !ticketDesc.trim()) {
        setFormError('Please complete the leave type, dates, and reason.');
        setIsSubmitting(false);
        return;
      }
      if (ticketDynamic.endDate < ticketDynamic.startDate) {
        setFormError('End date cannot be earlier than start date.');
        setIsSubmitting(false);
        return;
      }
      if (ticketDynamic.leaveType === 'Vacation Leave' && ticketDynamic.startDate < todayStr) {
        setFormError('Vacation leaves must be scheduled in advance.');
        setIsSubmitting(false);
        return;
      }
    } else if (ticketCategory === 'Others') {
      if (!ticketTitle.trim() || !ticketDesc.trim()) {
        setFormError('Please enter both subject and inquiry details.');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFormError('User session expired. Please re-login.');
        setIsSubmitting(false);
        return;
      }

      // Check for duplicate open ticket
      if (!activeTicket) {
        const { data: openTickets } = await supabase
          .from('tickets')
          .select('id, title, category, description, created_at')
          .eq('employee_id', session.user.id)
          .eq('status', 'open')
          .eq('category', ticketCategory);

        if (openTickets && openTickets.length > 0) {
          let conflict: any = null;
          if (ticketCategory === 'DTR Issue' && ticketDynamic.logDate) {
            conflict = openTickets.find(t => (t.description && t.description.includes(ticketDynamic.logDate)) || (t.title && t.title.includes(ticketDynamic.logDate)));
          } else if (ticketCategory === 'Payroll Issue' && ticketDynamic.payPeriod) {
            conflict = openTickets.find(t => (t.description && t.description.includes(ticketDynamic.payPeriod)) || (t.title && t.title.includes(ticketDynamic.payPeriod)));
          } else if (ticketCategory === 'File Leave' && ticketDynamic.startDate) {
            conflict = openTickets.find(t => (t.description && t.description.includes(ticketDynamic.startDate)) || (t.title && t.title.includes(ticketDynamic.startDate)));
          }

          if (conflict) {
            setIsSubmitting(false);
            Alert.alert(
              'Ticket Already Open',
              `You already have an active request (#${conflict.id.slice(0, 8).toUpperCase()}) for this period. A coordinator is currently reviewing it.`,
              [{ text: 'Dismiss', style: 'cancel' }]
            );
            return;
          }
        }
      }

      // Upload attachment if present
      let uploadedUrl: string | null = null;
      let uploadedType: string | null = null;
      if (attachedFile && attachedFile.uri) {
        const sanitizedName = attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${session.user.id}/${Date.now()}_${sanitizedName}`;
        const payload = await getFilePayload(attachedFile.uri);

        if (payload) {
          const { error: uploadError } = await supabase.storage.from('ticket_attachments').upload(filePath, payload, {
            contentType: attachedFile.mimeType || 'application/octet-stream',
            upsert: true
          });

          if (!uploadError) {
            const { data } = supabase.storage.from('ticket_attachments').getPublicUrl(filePath);
            uploadedUrl = data.publicUrl;
            uploadedType = attachedFile.mimeType || 'application/octet-stream';
          } else {
            console.error('Attachment upload failed:', uploadError);
          }
        }
      }

      // Build structured title & description
      let finalTitle = ticketTitle;
      let finalDesc = ticketDesc.trim();

      if (ticketCategory === 'Payroll Issue') {
        finalTitle = `Payroll Concern: ${ticketDynamic.payPeriod || 'Current Cutoff'}`;
        finalDesc = `Cutoff: ${ticketDynamic.payPeriod}\nDiscrepancy: ${ticketDynamic.discrepancyType || 'Not specified'}\nDetails: ${finalDesc}`;
      } else if (ticketCategory === 'Equipment Issue') {
        const tool = ticketDynamic.toolName === 'Other Tool' ? (ticketDynamic.customTool || 'Other Equipment') : (ticketDynamic.toolName || 'Equipment');
        finalTitle = `Tool Issue: ${tool}`;
        finalDesc = `Asset / Item: ${tool}\nReported Condition: ${ticketDynamic.issueType}\nDefect Description: ${finalDesc}`;
      } else if (ticketCategory === 'DTR Issue') {
        finalTitle = `DTR Adjustment: ${ticketDynamic.logDate}`;
        finalDesc = `Shift Date: ${ticketDynamic.logDate}\nReason: ${ticketDynamic.discrepancyType}\nRequested Times: In at ${ticketDynamic.expectedIn}, Out at ${ticketDynamic.expectedOut}\nExplanation: ${finalDesc}`;
      } else if (ticketCategory === 'File Leave') {
        finalTitle = `Leave Application: ${ticketDynamic.leaveType} (${leaveDurationDays} ${leaveDurationDays === 1 ? 'day' : 'days'})`;
        finalDesc = `Leave Type: ${ticketDynamic.leaveType}\nDuration: ${ticketDynamic.startDate} to ${ticketDynamic.endDate} (${leaveDurationDays} working ${leaveDurationDays === 1 ? 'day' : 'days'})\nReason: ${finalDesc}`;
      } else if (ticketCategory === 'Others') {
        finalTitle = ticketTitle.trim();
      }

      let ticketIdToReturn = activeTicket?.id;

      if (activeTicket) {
        const { error: updateError } = await supabase.from('tickets').update({
          title: finalTitle,
          category: ticketCategory,
          description: finalDesc,
          attachment_url: uploadedUrl || activeTicket.attachment_url,
          attachment_type: uploadedType || activeTicket.attachment_type,
          status: 'open',
        }).eq('id', activeTicket.id);

        if (updateError) throw updateError;
      } else {
        const { data: newTicket, error: insertError } = await supabase.from('tickets').insert({
          employee_id: session.user.id,
          title: finalTitle,
          category: ticketCategory,
          description: finalDesc,
          attachment_url: uploadedUrl,
          attachment_type: uploadedType,
          status: 'open',
          idempotency_key: idempotencyKey,
        }).select().single();

        if (insertError) {
          if (insertError.code === '23505') {
            setIsSubmitting(false);
            onClose();
            return;
          }
          throw insertError;
        }
        ticketIdToReturn = newTicket.id;
      }

      // Insert audit comments
      if (ticketIdToReturn) {
        const submissionContent = `📋 Form Submitted: ${ticketCategory}\nSubject: ${finalTitle}\n\n${finalDesc}`;

        await supabase.from('ticket_comments').insert({
          ticket_id: ticketIdToReturn,
          sender_role: 'technician',
          content: submissionContent,
          author_id: session.user.id,
          attachment_url: uploadedUrl,
          attachment_type: uploadedType
        });

        const targetDepartment = ticketCategory === 'Equipment Issue' ? 'Facilities & Tool Operations' : 'HR & Payroll Services';
        await supabase.from('ticket_comments').insert({
          ticket_id: ticketIdToReturn,
          sender_role: 'ai',
          content: `✅ Your ${ticketCategory} ticket has been submitted to ${targetDepartment} (Reference #${ticketIdToReturn.slice(0, 8).toUpperCase()}).\n\nA coordinator has been assigned to inspect your report. Updates will appear in real-time in this thread.`,
          author_id: session.user.id
        });

        // Broadcast realtime update
        try {
          const ch = supabase.channel('system-updates');
          ch.send({ type: 'broadcast', event: 'ticket_update', payload: { ticket_id: ticketIdToReturn } });
          ch.send({ type: 'broadcast', event: 'new_comment', payload: { ticket_id: ticketIdToReturn } });
        } catch (e) {
          // non-fatal
        }

        setIsSubmitting(false);
        onClose();
        onSubmissionSuccess(ticketIdToReturn);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'Submission failed. Please try again.');
    }
  };

  // Dynamic submit button label based on category
  const submitButtonLabel = useMemo(() => {
    if (isSubmitting) return 'Submitting Ticket...';
    switch (ticketCategory) {
      case 'Equipment Issue':
        return 'Submit Equipment Repair Ticket';
      case 'DTR Issue':
        return 'Submit Attendance Adjustment';
      case 'Payroll Issue':
        return 'Submit Payroll Inquiry to HR';
      case 'File Leave':
        return 'Submit Leave Application';
      default:
        return 'Submit Support Request';
    }
  }, [ticketCategory, isSubmitting]);

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={() => {
        if (formStep === 'tool_picker') setFormStep('details');
        else if (formStep === 'details' && !initialCategory && !initialTicketData) setFormStep('category');
        else onClose();
      }}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      propagateSwipe={true}
      swipeThreshold={60}
      style={styles.modal}
      avoidKeyboard={true}
    >
      <View style={[styles.sheetContainer, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
        {/* Drag Handle */}
        <View style={[styles.dragHandle, { backgroundColor: colors.cardBorder }]} />

        {formStep === 'category' ? (
          /* =========================================================================
             SCREEN 1: CATEGORY SELECTION (CLEAN ENTRY POINT)
             ========================================================================= */
          <View style={styles.contentFlex}>
            <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Report an Issue</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Select a category to get started</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.closeButton, { backgroundColor: isDark ? colors.subCard : '#F1F5F9' }]}
              >
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryListContainer}>
              {CATEGORY_ITEMS.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.75}
                  onPress={() => selectCategory(cat.id)}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isDark ? colors.subCard : '#F8FAFC',
                      borderColor: isDark ? colors.cardBorder : '#E2E8F0',
                    }
                  ]}
                >
                  <View style={[styles.categoryIconWrap, { backgroundColor: isDark ? cat.color + '25' : cat.color + '18' }]}>
                    <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                  </View>
                  <View style={styles.categoryTextWrap}>
                    <Text style={[styles.categoryLabel, { color: colors.text }]}>{cat.label}</Text>
                    <Text style={[styles.categoryDesc, { color: colors.textMuted }]} numberOfLines={1}>{cat.desc}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : formStep === 'tool_picker' ? (
          /* =========================================================================
             SCREEN 3: DEDICATED TOOL SEARCH & SELECTOR (NO PILL SOUP)
             ========================================================================= */
          <View style={styles.contentFlex}>
            <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setFormStep('details')}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="arrow-left" size={18} color={BRAND_BLUE} style={{ marginRight: 4 }} />
                <Text style={[styles.backButtonText, { color: BRAND_BLUE }]}>Back</Text>
              </TouchableOpacity>
              <Text style={[styles.headerCenterTitle, { color: colors.text }]}>Select Equipment</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={[styles.searchBar, { backgroundColor: isDark ? colors.subCard : '#F1F5F9', borderColor: isDark ? colors.cardBorder : '#E2E8F0' }]}>
              <Feather name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={toolSearchQuery}
                onChangeText={setToolSearchQuery}
                placeholder="Search tools by name or category..."
                placeholderTextColor={colors.textSubtle}
                style={[styles.searchInput, { color: colors.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {toolSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setToolSearchQuery('')}>
                  <Feather name="x-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Catalog List */}
            <ScrollView style={styles.contentFlex} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filteredTools.map((item) => {
                const isSelected = ticketDynamic.toolName === item.name;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setTicketDynamic((prev: any) => ({ ...prev, toolName: item.name, customTool: '' }));
                      setFormStep('details');
                    }}
                    style={[
                      styles.toolListItem,
                      {
                        backgroundColor: isSelected ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7') : 'transparent',
                        borderBottomColor: isDark ? colors.cardBorder : '#F1F5F9'
                      }
                    ]}
                  >
                    <View style={styles.toolListTextWrap}>
                      <Text style={[styles.toolListName, { color: isSelected ? '#B45309' : colors.text }]}>{item.name}</Text>
                      {item.category && <Text style={[styles.toolListCat, { color: colors.textMuted }]}>{item.category}</Text>}
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />}
                  </TouchableOpacity>
                );
              })}

              {/* Unlisted Tool Option */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setTicketDynamic((prev: any) => ({ ...prev, toolName: 'Other Tool' }));
                  setFormStep('details');
                }}
                style={[
                  styles.unlistedToolCard,
                  {
                    backgroundColor: ticketDynamic.toolName === 'Other Tool' ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7') : (isDark ? colors.subCard : '#F8FAFC'),
                    borderColor: ticketDynamic.toolName === 'Other Tool' ? '#F59E0B' : (isDark ? colors.cardBorder : '#CBD5E1')
                  }
                ]}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.textMuted} style={{ marginRight: 10 }} />
                <View style={styles.contentFlex}>
                  <Text style={[styles.unlistedTitle, { color: colors.text }]}>Other Tool / Not in Catalog</Text>
                  <Text style={[styles.unlistedSubtitle, { color: colors.textMuted }]}>Enter custom model name or asset ID</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          /* =========================================================================
             SCREEN 2: DETAILS FORM (SINGLE-COLUMN, FIELD-FIRST, NO PILL SOUP)
             ========================================================================= */
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.contentFlex}
          >
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (!initialCategory && !initialTicketData) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setFormStep('category');
                  } else {
                    onClose();
                  }
                }}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="arrow-left" size={18} color={BRAND_BLUE} style={{ marginRight: 4 }} />
                <Text style={[styles.backButtonText, { color: BRAND_BLUE }]}>Categories</Text>
              </TouchableOpacity>

              <View style={[styles.categoryBadge, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <Text style={[styles.categoryBadgeText, { color: colors.text }]}>{ticketCategory}</Text>
              </View>

              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Body */}
            <ScrollView
              ref={scrollRef}
              style={styles.contentFlex}
              contentContainerStyle={styles.formContentContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Date/Time Picker Modal */}
              {showDatePicker && (
                <DateTimePicker
                  value={dateVal}
                  mode={pickerMode}
                  display="default"
                  minimumDate={
                    pickerMode === 'time'
                      ? undefined
                      : ticketCategory === 'File Leave' && ticketDynamic.leaveType === 'Vacation Leave'
                      ? new Date()
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

              {/* -------------------------------------------------------------
                  SUB-FORM 1: PAYROLL ISSUE
                  ------------------------------------------------------------- */}
              {ticketCategory === 'Payroll Issue' && (
                <View style={styles.formSectionGap}>
                  {/* Affected Cutoff Selection */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Affected Cutoff Period</Text>
                    <View style={styles.pillRow}>
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
                            style={[
                              styles.touchTargetPill,
                              {
                                borderColor: isSelected ? BRAND_BLUE : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(30, 58, 138, 0.25)' : '#EFF6FF') : (isDark ? colors.subCard : '#FFF'),
                              }
                            ]}
                          >
                            <Text style={[styles.pillText, { color: isSelected ? BRAND_BLUE : colors.text, fontWeight: isSelected ? '700' : '600' }]}>
                              {idx === 2 && ticketDynamic.payPeriod && !ticketDynamic.payPeriod.includes(currentMonth) ? ticketDynamic.payPeriod : preset}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Discrepancy Type */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Discrepancy Type</Text>
                    <View style={{ gap: 8 }}>
                      {PAYROLL_DISCREPANCY_OPTIONS.map((opt, idx) => {
                        const isSelected = ticketDynamic.discrepancyType === opt;
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.7}
                            onPress={() => setTicketDynamic((prev: any) => ({ ...prev, discrepancyType: opt }))}
                            style={[
                              styles.radioSelectRow,
                              {
                                borderColor: isSelected ? BRAND_BLUE : (isDark ? colors.cardBorder : '#E2E8F0'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(30, 58, 138, 0.18)' : '#EFF6FF') : (isDark ? colors.subCard : '#FFF'),
                              }
                            ]}
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isSelected ? BRAND_BLUE : colors.textMuted}
                              style={{ marginRight: 10 }}
                            />
                            <Text style={[styles.radioSelectText, { color: isSelected ? BRAND_BLUE : colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Clean Textarea */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Explain the discrepancy</Text>
                    <TextInput
                      style={[
                        styles.textAreaInput,
                        {
                          borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                          color: colors.text
                        }
                      ]}
                      value={ticketDesc}
                      onChangeText={setTicketDesc}
                      multiline
                      placeholder="e.g. Worked 4 hours approved OT on Sep 8 but it was not reflected on my cutoff slip..."
                      placeholderTextColor={colors.textSubtle}
                    />
                  </View>
                </View>
              )}

              {/* -------------------------------------------------------------
                  SUB-FORM 2: EQUIPMENT ISSUE
                  ------------------------------------------------------------- */}
              {ticketCategory === 'Equipment Issue' && (
                <View style={styles.formSectionGap}>
                  {/* Tool Selection Card */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Tool or Equipment</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setToolSearchQuery('');
                        setFormStep('tool_picker');
                      }}
                      style={[
                        styles.selectorTriggerCard,
                        {
                          borderColor: ticketDynamic.toolName ? '#F59E0B' : (isDark ? colors.cardBorder : '#CBD5E1'),
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                        }
                      ]}
                    >
                      <View style={styles.triggerCardLeft}>
                        <View style={[styles.triggerIconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' }]}>
                          <Ionicons name="construct" size={18} color="#F59E0B" />
                        </View>
                        <View style={styles.contentFlex}>
                          <Text style={[styles.triggerTitle, { color: ticketDynamic.toolName ? colors.text : colors.textSubtle }]}>
                            {ticketDynamic.toolName === 'Other Tool'
                              ? 'Other / Custom Equipment'
                              : (ticketDynamic.toolName || 'Tap to select equipment from catalog...')}
                          </Text>
                          {ticketDynamic.toolName && ticketDynamic.toolName !== 'Other Tool' && (
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>Tap to change tool</Text>
                          )}
                        </View>
                      </View>
                      <Feather name="chevron-down" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Custom Tool Input if Other Tool Selected */}
                  {ticketDynamic.toolName === 'Other Tool' && (
                    <View>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Custom Tool Name / Asset Tag</Text>
                      <TextInput
                        style={[
                          styles.singleTextInput,
                          {
                            borderColor: '#F59E0B',
                            backgroundColor: isDark ? colors.subCard : '#FFF',
                            color: colors.text
                          }
                        ]}
                        placeholder="e.g. Robinair Manifold Gauge (Serial TC-901)"
                        placeholderTextColor={colors.textSubtle}
                        value={ticketDynamic.customTool || ''}
                        onChangeText={(val) => setTicketDynamic((prev: any) => ({ ...prev, customTool: val }))}
                      />
                    </View>
                  )}

                  {/* Problem Type Selector (3 Clean Cards) */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>What happened to the equipment?</Text>
                    <View style={styles.segmentedRow}>
                      {ISSUE_TYPES.map((type, idx) => {
                        const isSelected = ticketDynamic.issueType === type.value;
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.75}
                            onPress={() => setTicketDynamic((prev: any) => ({ ...prev, issueType: type.value }))}
                            style={[
                              styles.segmentedCard,
                              {
                                borderColor: isSelected ? type.color : (isDark ? colors.cardBorder : '#E2E8F0'),
                                backgroundColor: isSelected ? (isDark ? type.color + '22' : type.color + '12') : (isDark ? colors.subCard : '#FFF'),
                              }
                            ]}
                          >
                            <Ionicons name={type.icon as any} size={18} color={isSelected ? type.color : colors.textMuted} style={{ marginBottom: 4 }} />
                            <Text style={[styles.segmentedText, { color: isSelected ? type.color : colors.text, fontWeight: isSelected ? '700' : '600' }]}>
                              {type.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Defect Description */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Describe the defect or symptoms</Text>
                    <TextInput
                      style={[
                        styles.textAreaInput,
                        {
                          borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                          color: colors.text
                        }
                      ]}
                      value={ticketDesc}
                      onChangeText={setTicketDesc}
                      multiline
                      placeholder="e.g. Motor sparks under load, chuck gets stuck on 1/2 inch drill bits..."
                      placeholderTextColor={colors.textSubtle}
                    />
                  </View>
                </View>
              )}

              {/* -------------------------------------------------------------
                  SUB-FORM 3: DTR / TIME DISCREPANCY
                  ------------------------------------------------------------- */}
              {ticketCategory === 'DTR Issue' && (
                <View style={styles.formSectionGap}>
                  {/* Shift Date Selector */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Which shift was affected?</Text>
                    <View style={styles.pillRow}>
                      {[
                        { label: 'Today', val: todayStr },
                        { label: 'Yesterday', val: yesterdayStr },
                        { label: 'Pick Date...', val: 'custom' }
                      ].map((preset, idx) => {
                        const isSelected = preset.val === 'custom'
                          ? (ticketDynamic.logDate && ticketDynamic.logDate !== todayStr && ticketDynamic.logDate !== yesterdayStr)
                          : ticketDynamic.logDate === preset.val;
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.7}
                            onPress={() => {
                              if (preset.val === 'custom') {
                                setDateTarget('logDate');
                                setDateVal(new Date());
                                setPickerMode('date');
                                setShowDatePicker(true);
                              } else {
                                setTicketDynamic((prev: any) => ({ ...prev, logDate: preset.val }));
                              }
                            }}
                            style={[
                              styles.touchTargetPill,
                              {
                                borderColor: isSelected ? BRAND_BLUE : (isDark ? colors.cardBorder : '#CBD5E1'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(30, 58, 138, 0.25)' : '#EFF6FF') : (isDark ? colors.subCard : '#FFF'),
                              }
                            ]}
                          >
                            <Text style={[styles.pillText, { color: isSelected ? BRAND_BLUE : colors.text, fontWeight: isSelected ? '700' : '600' }]}>
                              {preset.val === 'custom' && isSelected ? ticketDynamic.logDate : preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Discrepancy Reason */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>What happened with your log?</Text>
                    <View style={{ gap: 8 }}>
                      {DTR_DISCREPANCY_OPTIONS.map((opt, idx) => {
                        const isSelected = ticketDynamic.discrepancyType === opt;
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.7}
                            onPress={() => setTicketDynamic((prev: any) => ({ ...prev, discrepancyType: opt }))}
                            style={[
                              styles.radioSelectRow,
                              {
                                borderColor: isSelected ? BRAND_BLUE : (isDark ? colors.cardBorder : '#E2E8F0'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(30, 58, 138, 0.18)' : '#EFF6FF') : (isDark ? colors.subCard : '#FFF'),
                              }
                            ]}
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isSelected ? BRAND_BLUE : colors.textMuted}
                              style={{ marginRight: 10 }}
                            />
                            <Text style={[styles.radioSelectText, { color: isSelected ? BRAND_BLUE : colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Actual In & Out Times */}
                  <View style={styles.sideBySideRow}>
                    <View style={styles.contentFlex}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Actual Time In</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setDateTarget('expectedIn');
                          setDateVal(new Date());
                          setPickerMode('time');
                          setShowDatePicker(true);
                        }}
                        style={[styles.timeBox, { borderColor: isDark ? colors.cardBorder : '#CBD5E1', backgroundColor: isDark ? colors.subCard : '#FFF' }]}
                      >
                        <Ionicons name="time-outline" size={16} color={BRAND_BLUE} style={{ marginRight: 6 }} />
                        <Text style={[styles.timeText, { color: colors.text }]}>
                          {ticketDynamic.expectedIn || '08:00 AM'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.contentFlex}>
                      <Text style={[styles.inputLabel, { color: colors.text }]}>Actual Time Out</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setDateTarget('expectedOut');
                          setDateVal(new Date());
                          setPickerMode('time');
                          setShowDatePicker(true);
                        }}
                        style={[styles.timeBox, { borderColor: isDark ? colors.cardBorder : '#CBD5E1', backgroundColor: isDark ? colors.subCard : '#FFF' }]}
                      >
                        <Ionicons name="time-outline" size={16} color={BRAND_BLUE} style={{ marginRight: 6 }} />
                        <Text style={[styles.timeText, { color: colors.text }]}>
                          {ticketDynamic.expectedOut || '05:00 PM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Notes */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Supervisor on site or reason for correction</Text>
                    <TextInput
                      style={[
                        styles.textAreaInput,
                        {
                          borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                          color: colors.text
                        }
                      ]}
                      value={ticketDesc}
                      onChangeText={setTicketDesc}
                      multiline
                      placeholder="e.g. Biometrics offline on site. Shift verified by Supervisor Mark..."
                      placeholderTextColor={colors.textSubtle}
                    />
                  </View>
                </View>
              )}

              {/* -------------------------------------------------------------
                  SUB-FORM 4: FILE LEAVE (ADMINISTRATIVE SERVICE REQUEST)
                  ------------------------------------------------------------- */}
              {ticketCategory === 'File Leave' && (
                <View style={styles.formSectionGap}>
                  {/* Leave Type Selector */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Leave Type</Text>
                    <View style={{ gap: 8 }}>
                      {LEAVE_TYPES.map((lt, idx) => {
                        const isSelected = ticketDynamic.leaveType === lt.label;
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.75}
                            onPress={() => setTicketDynamic((prev: any) => ({ ...prev, leaveType: lt.label }))}
                            style={[
                              styles.radioSelectRow,
                              {
                                borderColor: isSelected ? BRAND_BLUE : (isDark ? colors.cardBorder : '#E2E8F0'),
                                backgroundColor: isSelected ? (isDark ? 'rgba(30, 58, 138, 0.18)' : '#EFF6FF') : (isDark ? colors.subCard : '#FFF'),
                              }
                            ]}
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isSelected ? BRAND_BLUE : colors.textMuted}
                              style={{ marginRight: 10 }}
                            />
                            <View style={styles.contentFlex}>
                              <Text style={[styles.radioSelectText, { color: isSelected ? BRAND_BLUE : colors.text, fontWeight: isSelected ? '700' : '600' }]}>
                                {lt.label}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.textMuted }}>{lt.desc}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Date Range Selection with Total Days Badge */}
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 0 }]}>Leave Schedule</Text>
                      <View style={[styles.daysBadge, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE' }]}>
                        <Text style={[styles.daysBadgeText, { color: BRAND_BLUE }]}>
                          {leaveDurationDays} {leaveDurationDays === 1 ? 'Day' : 'Days'} Total
                        </Text>
                      </View>
                    </View>

                    <View style={styles.sideBySideRow}>
                      <View style={styles.contentFlex}>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Start Date</Text>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            setDateTarget('startDate');
                            setDateVal(new Date());
                            setPickerMode('date');
                            setShowDatePicker(true);
                          }}
                          style={[styles.timeBox, { borderColor: isDark ? colors.cardBorder : '#CBD5E1', backgroundColor: isDark ? colors.subCard : '#FFF' }]}
                        >
                          <Ionicons name="calendar-outline" size={16} color={BRAND_BLUE} style={{ marginRight: 6 }} />
                          <Text style={[styles.timeText, { color: colors.text }]}>{ticketDynamic.startDate || tomorrowStr}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.contentFlex}>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>End Date</Text>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            setDateTarget('endDate');
                            setDateVal(new Date());
                            setPickerMode('date');
                            setShowDatePicker(true);
                          }}
                          style={[styles.timeBox, { borderColor: isDark ? colors.cardBorder : '#CBD5E1', backgroundColor: isDark ? colors.subCard : '#FFF' }]}
                        >
                          <Ionicons name="calendar-outline" size={16} color={BRAND_BLUE} style={{ marginRight: 6 }} />
                          <Text style={[styles.timeText, { color: colors.text }]}>{ticketDynamic.endDate || tomorrowStr}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Sick Leave Policy Hint */}
                  {ticketDynamic.leaveType === 'Sick Leave' && leaveDurationDays >= 2 && (
                    <View style={[styles.policyHintBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB', borderColor: '#FDE68A' }]}>
                      <Ionicons name="information-circle-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: isDark ? '#FCD34D' : '#92400E', flex: 1 }}>
                        HR policy requires a doctor's certificate for sick leaves spanning 2 or more consecutive days.
                      </Text>
                    </View>
                  )}

                  {/* Reason */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Reason for leave</Text>
                    <TextInput
                      style={[
                        styles.textAreaInput,
                        {
                          borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                          color: colors.text
                        }
                      ]}
                      value={ticketDesc}
                      onChangeText={setTicketDesc}
                      multiline
                      placeholder="e.g. Scheduled medical checkup and recovery..."
                      placeholderTextColor={colors.textSubtle}
                    />
                  </View>
                </View>
              )}

              {/* -------------------------------------------------------------
                  SUB-FORM 5: OTHERS / GENERAL INQUIRY
                  ------------------------------------------------------------- */}
              {ticketCategory === 'Others' && (
                <View style={styles.formSectionGap}>
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Subject / Topic</Text>
                    <TextInput
                      style={[
                        styles.singleTextInput,
                        {
                          borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                          color: colors.text
                        }
                      ]}
                      value={ticketTitle}
                      onChangeText={setTicketTitle}
                      placeholder="e.g. Request for Certificate of Employment (COE)"
                      placeholderTextColor={colors.textSubtle}
                    />
                  </View>

                  <View>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Explain your concern</Text>
                    <TextInput
                      style={[
                        styles.textAreaInput,
                        {
                          borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                          backgroundColor: isDark ? colors.subCard : '#FFF',
                          color: colors.text
                        }
                      ]}
                      value={ticketDesc}
                      onChangeText={setTicketDesc}
                      multiline
                      placeholder="Provide full details of your request or question..."
                      placeholderTextColor={colors.textSubtle}
                    />
                  </View>
                </View>
              )}

              {/* -------------------------------------------------------------
                  ATTACHMENT / PROOF SECTION (UNIFIED ACROSS ALL CATEGORIES)
                  ------------------------------------------------------------- */}
              <View style={styles.attachmentSection}>
                <Text style={[styles.inputLabel, { color: colors.text, marginBottom: 6 }]}>
                  {ticketCategory === 'Equipment Issue'
                    ? 'Photo Evidence of Defect (Recommended)'
                    : 'Supporting Document / Photo (Optional)'}
                </Text>

                {attachedFile ? (
                  <View
                    style={[
                      styles.attachedFileBox,
                      {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4',
                        borderColor: isDark ? '#059669' : '#86EFAC',
                      }
                    ]}
                  >
                    <View style={styles.attachedFileLeft}>
                      <View style={[styles.attachedIconWrap, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#DCFCE7' }]}>
                        <Ionicons name="document-attach" size={20} color="#16A34A" />
                      </View>
                      <View style={styles.contentFlex}>
                        <Text style={[styles.attachedFileName, { color: isDark ? '#A7F3D0' : '#166534' }]} numberOfLines={1}>
                          {attachedFile.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#6EE7B7' : '#15803D' }}>
                          Ready to upload ({(attachedFile.size ? (attachedFile.size / 1024).toFixed(0) : 0)} KB)
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setAttachedFile(null)} style={{ padding: 6 }}>
                      <Feather name="trash-2" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={pickAttachment}
                    style={[
                      styles.uploadDashedCard,
                      {
                        borderColor: isDark ? colors.cardBorder : '#CBD5E1',
                        backgroundColor: isDark ? colors.subCard : '#F8FAFC',
                      }
                    ]}
                  >
                    <View style={[styles.uploadIconWrap, { backgroundColor: isDark ? colors.card : '#EEF2F6' }]}>
                      <Feather name="camera" size={18} color={BRAND_BLUE} />
                    </View>
                    <View style={styles.contentFlex}>
                      <Text style={[styles.uploadPromptText, { color: colors.text }]}>
                        {ticketCategory === 'Equipment Issue' ? 'Take photo or choose from gallery' : 'Attach photo or document'}
                      </Text>
                      <Text style={[styles.uploadHelpText, { color: colors.textMuted }]}>PNG, JPG, PDF, Docx (Max 5MB)</Text>
                    </View>
                    <Feather name="upload-cloud" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Inline Error Message */}
              {formError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Fixed Bottom Action Bar (Thumb Zone) */}
            <View style={[styles.actionBarContainer, { borderTopColor: colors.cardBorder, backgroundColor: colors.card }]}>
              <TouchableOpacity
                disabled={isSubmitting}
                activeOpacity={0.85}
                onPress={handleSubmit}
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: isSubmitting ? '#94A3B8' : BRAND_BLUE,
                    shadowColor: BRAND_BLUE,
                  }
                ]}
              >
                {isSubmitting ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Submitting Ticket...</Text>
                  </View>
                ) : (
                  <View style={styles.loadingRow}>
                    <Ionicons name="paper-plane-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>{submitButtonLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    maxHeight: '92%',
    flex: 1,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  contentFlex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerCenterTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  categoryListContainer: {
    paddingBottom: 24,
    gap: 10,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  categoryTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  categoryDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  toolListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
  },
  toolListTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  toolListName: {
    fontSize: 14,
    fontWeight: '700',
  },
  toolListCat: {
    fontSize: 11,
    marginTop: 2,
  },
  unlistedToolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  unlistedTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  unlistedSubtitle: {
    fontSize: 11,
  },
  formContentContainer: {
    paddingBottom: 24,
  },
  formSectionGap: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  touchTargetPill: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: {
    fontSize: 12,
  },
  radioSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  radioSelectText: {
    fontSize: 13,
  },
  textAreaInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  singleTextInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
  },
  selectorTriggerCard: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  triggerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  triggerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentedCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentedText: {
    fontSize: 11,
    textAlign: 'center',
  },
  sideBySideRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeBox: {
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  policyHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  attachmentSection: {
    marginTop: 16,
  },
  attachedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  attachedFileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  attachedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  attachedFileName: {
    fontSize: 13,
    fontWeight: '700',
  },
  uploadDashedCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  uploadPromptText: {
    fontSize: 13,
    fontWeight: '700',
  },
  uploadHelpText: {
    fontSize: 11,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  actionBarContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
