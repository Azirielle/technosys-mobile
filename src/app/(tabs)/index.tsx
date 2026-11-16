import React, { useState, useEffect, useRef, useMemo } from 'react';
import RNModal from 'react-native-modal';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing, ActivityIndicator, ScrollView, Image, Alert, Platform, FlatList, TextInput, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistance } from 'geolib';
import MapView, { Marker, Circle, Polyline } from '../../components/MapWrapper';
import { supabase } from '../../lib/supabase';
import { syncQueue, generateUUID } from '../../lib/syncQueue';
import { uploadPhoto } from '../../lib/photoUpload';
import { getDeviceId } from '../../lib/deviceId';
import { isWrongPhoneError, WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE } from '../../lib/signIn';
import { openDirections } from '../../lib/directions';
import NavigateButton from '../../components/NavigateButton';
import { getJobCrew } from '../../lib/crew';
import { jobTitle } from '../../lib/jobTitle';
import { shiftBadge } from '../../lib/shiftStatus';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import DateTimePicker from '@react-native-community/datetimepicker';
import SupportChatUI from '../../components/SupportChatUI';
import { getNotifications } from '../../lib/notifications';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAppTheme } from '../../context/ThemeContext';
import { AppThemeColors } from '../../constants/theme';
import { sanitizeNotification, formatRelativeTime } from '../../utils/notification-sanitizer';
import PolicyReaderModal, { CompanyPolicy } from '../../components/PolicyReaderModal';
import PolicyEnforcementModal from '../../components/PolicyEnforcementModal';
import { formatMobileError } from '../../lib/errorSanitizer';
import { onHomeAction } from '../../lib/homeActions';
import { GlowScreen, techy } from '../../ui';
import HomeBody from '../../components/home/HomeBody';

// Midnight today in Manila (UTC+8), as an ISO time
const manilaTodayStartIso = () => new Date(Date.parse(new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z') - 8 * 3600000).toISOString();

const { width, height } = Dimensions.get('window');

interface NotificationItem {
  id: string;
  type: 'dispatch' | 'hr' | 'tool' | 'admin' | 'help';
  title: string;
  desc: string;
  time: string;
  read: boolean;
  ticketId?: string;
  timestamp: number;
  category?: string;
  categoryColor?: string;
  categoryBgLight?: string;
  categoryBgDark?: string;
  reviewer?: string;
  statusTag?: string;
  actionLabel?: string;
  actionType?: 'chat' | 'dispatch' | 'announcement' | 'tool' | 'general';
}

// TECHONOSYS PRO BRAND COLORS
const BRAND = {
  blue: '#1E3A8A',    
  yellow: '#FBBF24',  
  green: '#10B981',   
  red: '#EF4444',     
  lightBg: '#F8FAFC',
};

// Screen text in English and Filipino (Settings → Language). Japanese was removed.
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    priority_dispatch: "YOUR NEXT JOB",
    active_ticket: "Tap for details",
    view_dispatch_details: "Job details",
    navigate: "Navigate",
    no_active_deployments: "No job assigned to you yet.",
    menu: "Menu",
    my_operations: "My work",
    schedules: "Schedules",
    file_leave: "File Leave",
    timesheets: "Timesheets",
    announcements: "Announcements",
    my_tools: "My Tools",
    clock_in: "Time In",
    tap_to_verify: "Tap to check your location",
    preferences: "Settings",
    dark_mode: "Dark Mode",
    appearance: "Appearance",
    theme_light: "Light",
    theme_dark: "Dark",
    theme_system: "Same as phone",
    language: "Language",
    settings: "Settings",
    equipment: "Equipment",
    support: "Support",
    updates: "Updates",
  },
  tl: {
    priority_dispatch: "SUSUNOD MONG TRABAHO",
    active_ticket: "Pindutin para sa detalye",
    view_dispatch_details: "Detalye ng trabaho",
    navigate: "Ituro ang daan",
    no_active_deployments: "Wala ka pang naka-assign na trabaho.",
    menu: "Menu",
    my_operations: "Aking trabaho",
    schedules: "Mga Iskedyul",
    file_leave: "Mag-file ng Leave",
    timesheets: "Oras ko",
    announcements: "Mga Anunsyo",
    my_tools: "Aking Gamit",
    clock_in: "Time In",
    tap_to_verify: "Pindutin para i-check ang lokasyon mo",
    preferences: "Settings",
    dark_mode: "Dark Mode",
    appearance: "Itsura",
    theme_light: "Maliwanag",
    theme_dark: "Madilim",
    theme_system: "Kapareho ng phone",
    language: "Wika",
    settings: "Settings",
    equipment: "Gamit",
    support: "Tulong",
    updates: "Mga Balita",
  },
};
export default function HomeScreen() {
  const router = useRouter();
  // Job details is its own screen now (app/job/[id].tsx); without a job, the Jobs tab
  const openJobDetails = () => { if (schedule?.id) router.push(`/job/${schedule.id}` as Href); else router.navigate('/(tabs)/jobs' as Href); };
  const pushNotificationState = usePushNotifications();
  const { themeMode, isDark, language, colors, setThemeMode, setLanguage } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  
  const t = (key: string) => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };
  const activeFont = 'DMSans-Medium';
  const activeFontBold = 'DMSans-Bold';
  
  const [menuVisible, setMenuVisible] = useState(false);
  
    const [clockInModal, setClockInModal] = useState(false);
    
    // Aura pulsing animation
    const auraAnim = useRef(new Animated.Value(1)).current;
    
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(auraAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(auraAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          })
        ])
      ).start();
    }, []);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  
  const safeAlert = (title: string, msg: string) => {
    const cleanMsg = formatMobileError(msg);
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${cleanMsg}`);
    } else {
      Alert.alert(title, cleanMsg);
    }
  };

  // Chunk 13.2 States
  const [dtrModalVisible, setDtrModalVisible] = useState(false);
  const [formsModalVisible, setFormsModalVisible] = useState(false);
  const [dtrLogs, setDtrLogs] = useState<any[]>([]);
  const [dtrLoading, setDtrLoading] = useState(false);

  // Task 37: TechnoCycle Policy Registry & Clickwrap Compliance States
  const [policies, setPolicies] = useState<CompanyPolicy[]>([]);
  const [policyAcks, setPolicyAcks] = useState<Record<string, { version: string; acknowledged_at: string }>>({});
  const [unacknowledgedPolicies, setUnacknowledgedPolicies] = useState<CompanyPolicy[]>([]);
  const [selectedPolicyForReader, setSelectedPolicyForReader] = useState<CompanyPolicy | null>(null);
  const [policyReaderModalVisible, setPolicyReaderModalVisible] = useState(false);
  const [policyEnforcementVisible, setPolicyEnforcementVisible] = useState(false);
  const [policyEnforcementReason, setPolicyEnforcementReason] = useState<'post_punch'>('post_punch');
  const [policyLoading, setPolicyLoading] = useState(false);

  const fetchPoliciesAndAcks = async (userId?: string) => {
    try {
      setPolicyLoading(true);
      const targetUid = userId || profile?.id;

      // 1. Fetch active company policies
      let loadedPolicies: CompanyPolicy[] = [];
      const { data: policiesData, error: polError } = await supabase
        .from('policies')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (!polError && policiesData && policiesData.length > 0) {
        loadedPolicies = policiesData as CompanyPolicy[];
        await AsyncStorage.setItem('@technocycle_cached_policies', JSON.stringify(policiesData)).catch(() => {});
      } else {
        const cached = await AsyncStorage.getItem('@technocycle_cached_policies');
        if (cached) {
          try {
            loadedPolicies = JSON.parse(cached);
          } catch (e) {}
        }
      }
      setPolicies(loadedPolicies);

      // 2. Fetch acknowledgments for this user
      if (targetUid) {
        const { data: acksData, error: ackError } = await supabase
          .from('policy_acknowledgments')
          .select('policy_id, policy_version, acknowledged_at')
          .eq('user_id', targetUid);

        const ackMap: Record<string, { version: string; acknowledged_at: string }> = {};
        if (!ackError && acksData) {
          acksData.forEach((a: any) => {
            ackMap[a.policy_id] = {
              version: a.policy_version,
              acknowledged_at: a.acknowledged_at,
            };
          });
          setPolicyAcks(ackMap);
        }

        // 3. Compute unacknowledged mandatory policies
        const pendingMandatory = loadedPolicies.filter(p => {
          if (!p.is_mandatory) return false;
          if (p.target_audience === 'admin') return false;
          const userAck = ackMap[p.id];
          return !userAck || userAck.version !== p.version;
        });

        setUnacknowledgedPolicies(pendingMandatory);
        return pendingMandatory;
      }
    } catch (err) {
      console.warn("Failed to fetch policies and acknowledgments:", err);
    } finally {
      setPolicyLoading(false);
    }
    return [];
  };

  const handleAcknowledgePolicy = async (policyId: string, version: string): Promise<boolean> => {
    const targetUid = profile?.id;
    if (!targetUid) {
      safeAlert('Error', 'User profile not identified.');
      return false;
    }

    try {
      const userAgent = `TechnoCycle Mobile (${Platform.OS}; ${Device.modelName || 'Device'})`;
      const { error } = await supabase
        .from('policy_acknowledgments')
        .upsert(
          {
            user_id: targetUid,
            policy_id: policyId,
            policy_version: version,
            acknowledged_at: new Date().toISOString(),
            ip_address: userLoc ? `${userLoc.lat},${userLoc.lon}` : 'Mobile Session',
            user_agent: userAgent,
          },
          { onConflict: 'user_id, policy_id, policy_version' }
        );

      if (error) throw error;

      await fetchPoliciesAndAcks(targetUid);
      return true;
    } catch (err: any) {
      console.error("Error acknowledging policy:", err);
      safeAlert('Submission Error', err.message || 'Could not record acknowledgment.');
      return false;
    }
  };

  // Policies never block Tools, Leave or Timesheets (decided 16 Nov). Unsigned ones are
  // still reminded after time-in and listed in Company forms and handbooks.
  // The one-time "app rules" screen at first login comes in Step 2.
  const checkPolicyGateBeforeAction = (actionCallback: () => void) => {
    actionCallback();
  };

  // Chunk 14: Notifications
  const [notifVisible, setNotifVisible] = useState(false);
  const notifAnim = useRef(new Animated.Value(width)).current;
  const [dispatchVisible, setDispatchVisible] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const [selectedChatTicketId, setSelectedChatTicketId] = useState<string | null>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  const formatNotifTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch (e) {
      return 'Recently';
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const rawReadIds = await AsyncStorage.getItem(`READ_NOTIFS_${user.id}`);
      const readSet = new Set<string>(rawReadIds ? JSON.parse(rawReadIds) : []);

      const items: NotificationItem[] = [];

      // 1. Fetch Technician Tickets
      const { data: userTickets } = await supabase
        .from('tickets')
        .select('id, title, category, status, created_at, updated_at')
        .eq('employee_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (userTickets && userTickets.length > 0) {
        const ticketIds = userTickets.map(t => t.id);
        const ticketMap = new Map(userTickets.map(t => [t.id, t]));

        // Fetch recent Admin comments or system decision comments
        const { data: comments } = await supabase
          .from('ticket_comments')
          .select('id, ticket_id, content, created_at, sender_role, is_internal')
          .in('ticket_id', ticketIds)
          .in('sender_role', ['admin', 'system'])
          .eq('is_internal', false)
          .order('created_at', { ascending: false })
          .limit(20);

        if (comments) {
          comments.forEach(c => {
            const t = ticketMap.get(c.ticket_id);
            const isApproved = c.content.includes('[DECISION: APPROVED');
            const isRefused = c.content.includes('[DECISION: REFUSED');
            
            const rawType = isApproved ? 'hr' : isRefused ? 'help' : 'admin';
            const rawTitle = isApproved 
              ? `Ticket Approved (${t?.category || 'HR'})`
              : isRefused 
              ? `Ticket Refused (${t?.category || 'HR'})`
              : `HR Message: ${t?.title || t?.category || 'Support'}`;

            const parsed = sanitizeNotification(rawTitle, c.content, rawType, t?.category);

            items.push({
              id: `tc_${c.id}`,
              type: rawType,
              title: parsed.title,
              desc: parsed.summary,
              time: formatRelativeTime(c.created_at as string),
              read: readSet.has(`tc_${c.id}`),
              ticketId: c.ticket_id,
              timestamp: new Date(c.created_at as string).getTime(),
              category: parsed.category,
              categoryColor: parsed.categoryColor,
              categoryBgLight: parsed.categoryBgLight,
              categoryBgDark: parsed.categoryBgDark,
              reviewer: parsed.reviewer,
              statusTag: parsed.statusTag,
              actionLabel: parsed.actionLabel,
              actionType: parsed.actionType,
            });
          });
        }
      }

      // 2. Fetch Recent Company Announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('id, title, content, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (announcementsData) {
        announcementsData.forEach(a => {
          const parsed = sanitizeNotification(a.title, a.content || 'Company announcement posted.', 'admin', 'Announcement');
          items.push({
            id: `ann_${a.id}`,
            type: 'admin',
            title: parsed.title,
            desc: parsed.summary,
            time: formatRelativeTime(a.created_at as string),
            read: readSet.has(`ann_${a.id}`),
            timestamp: new Date(a.created_at as string).getTime(),
            category: parsed.category,
            categoryColor: parsed.categoryColor,
            categoryBgLight: parsed.categoryBgLight,
            categoryBgDark: parsed.categoryBgDark,
            actionLabel: 'Read Announcement',
            actionType: 'announcement',
          });
        });
      }

      // Sort newest first
      items.sort((a, b) => b.timestamp - a.timestamp);

      if (items.length === 0) {
        items.push({
          id: 'welcome_init',
          type: 'hr',
          title: 'Welcome to TechnoCycle',
          desc: 'Operational alerts, dispatches, and HR tickets appear here in real time.',
          time: 'Active',
          read: true,
          timestamp: Date.now(),
          category: 'Operations',
          categoryColor: '#3B82F6',
          categoryBgLight: '#EFF6FF',
          categoryBgDark: 'rgba(59, 130, 246, 0.2)',
          statusTag: 'Active',
          actionLabel: 'Explore System',
          actionType: 'general',
        });
      }

      setNotifications(items);
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    }
  };

  const markNotificationRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const raw = await AsyncStorage.getItem(`READ_NOTIFS_${user.id}`);
        const set = new Set<string>(raw ? JSON.parse(raw) : []);
        set.add(notifId);
        await AsyncStorage.setItem(`READ_NOTIFS_${user.id}`, JSON.stringify(Array.from(set)));
      }
    } catch (e) {
      console.warn("Could not persist read notification", e);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const allIds = notifications.map(n => n.id);
        await AsyncStorage.setItem(`READ_NOTIFS_${user.id}`, JSON.stringify(allIds));
      }
    } catch (e) {
      console.warn("Could not persist all read notifications", e);
    }
  };

  // Chunk 15: Equipment Menu
  const [equipModalVisible, setEquipModalVisible] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  const fetchEquipment = async () => {
    setToolsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('tool_borrowings')
          .select('id, quantity, status, handed_over_at, returned_at, notes, condition_on_return, tool_catalog:tools ( id, name, description, image_url, category, serial_number )')
          .eq('technician_id', user.id)
          .order('handed_over_at', { ascending: false });
        
        if (error) throw error;
        setTools(data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch equipment:', e);
    } finally {
      setToolsLoading(false);
    }
  };

  const handleReportToolIssue = (toolItem: any) => {
    setEquipModalVisible(false);
    const toolName = toolItem.tool_catalog?.name || 'Equipment';
    const serial = toolItem.tool_catalog?.serial_number ? ` (SN: ${toolItem.tool_catalog.serial_number})` : '';
    const queryText = `Reporting an issue/damage for ${toolName}${serial}: `;
    setAiInitialQuery(queryText);
    setAiInitialTicketData({
      category: 'Equipment / Tools',
      title: `Issue with ${toolName}`,
      description: queryText,
      reason: queryText,
    });
    setTimeout(() => {
      setSupportModalVisible(true);
    }, 350);
  };

  // Chunk 16: Support & Ticketing
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [createTicketMode, setCreateTicketMode] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  const [ticketForm, setTicketForm] = useState({ title: '', category: 'HR & Attendance', description: '' });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const TICKET_CATEGORIES = ['HR & Attendance', 'IT & App Support', 'Equipment / Tools', 'Schedule & Dispatch'];

  const fetchTickets = async () => {
    setTicketsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('tickets')
        .select('*')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });
      
      setTickets(data || []);
    }
    setTicketsLoading(false);
  };

  

  const submitTicket = async () => {
    if (!ticketForm.title || !ticketForm.description) {
      safeAlert('Error', 'Please fill in all fields.');
      return;
    }
    setIsSubmittingTicket(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('tickets').insert([{
        employee_id: user.id,
        title: ticketForm.title,
        category: ticketForm.category,
        description: ticketForm.description,
        status: 'open',
        priority: 'medium'
      }]);
      
      if (error) {
        safeAlert('Error', error.message);
      } else {
        safeAlert('Success', 'Ticket submitted successfully!');
        setCreateTicketMode(false);
        setTicketForm({ title: '', category: 'HR & Attendance', description: '' });
        fetchTickets();
      }
    }
    setIsSubmittingTicket(false);
  };

  // Chunk 17: Announcements & Updates
  const [updatesModalVisible, setUpdatesModalVisible] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [unreadAnnouncement, setUnreadAnnouncement] = useState<any>(null);
  const [expandedUpdates, setExpandedUpdates] = useState<{[key: string]: boolean}>({});
  const [selectedUpdate, setSelectedUpdate] = useState<any>(null);

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    // Announcements are global (or branch specific), so we fetch the most recent ones.
    const { data } = await supabase
      .from('announcements')
      .select(`
        id, title, content, created_at,
        profiles!announcements_created_by_fkey ( full_name, role )
      `)
      .order('created_at', { ascending: false });
    
    // If the join fails due to fk name mismatches, fallback to basic select.
    if (!data) {
      const fallback = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      setAnnouncements(fallback.data || []);
    } else {
      setAnnouncements(data);
    }
    setAnnouncementsLoading(false);
  };

  // Chunk 19: Work Orders Feature

  const [aiInitialQuery, setAiInitialQuery] = useState('');
  const [aiInitialTicketData, setAiInitialTicketData] = useState<any | null>(null);

  // File Leave Feature
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [createLeaveMode, setCreateLeaveMode] = useState(false);
  const [newLeaveType, setNewLeaveType] = useState('vacation');
  const [newLeaveStartDate, setNewLeaveStartDate] = useState('');
  const [newLeaveEndDate, setNewLeaveEndDate] = useState('');
  const [newLeaveReason, setNewLeaveReason] = useState('');
    const [leaveFile, setLeaveFile] = useState<any>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Timesheets & Live Attendance Feature
  const [timesheetModalVisible, setTimesheetModalVisible] = useState(false);
  const [shiftDisputeModalVisible, setShiftDisputeModalVisible] = useState(false);
  const [hasClockedInToday, setHasClockedInToday] = useState(false);
  const [activeTimeLog, setActiveTimeLog] = useState<any | null>(null);
  const [todayCompletedLog, setTodayCompletedLog] = useState<any | null>(null);
  const [clockingOut, setClockingOut] = useState(false);
  const [elapsedShiftTime, setElapsedShiftTime] = useState<string>('');
  const [targetGeofence, setTargetGeofence] = useState<{
    name: string;
    lat: number;
    lon: number;
    radius: number;
  } | null>(null);

  // Live Shift Timer Effect
  useEffect(() => {
    if (!activeTimeLog?.app_time_in) {
      setElapsedShiftTime('');
      return;
    }
    
    const updateElapsed = () => {
      const diffMs = Math.max(0, Date.now() - new Date(activeTimeLog.app_time_in).getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setElapsedShiftTime(`${hours}h ${mins}m`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [activeTimeLog]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [selectedTimeLog, setSelectedTimeLog] = useState<any>(null);
  const [timesheetLoading, setTimesheetLoading] = useState(false);

  // Schedules Feature
  const [schedulesModalVisible, setSchedulesModalVisible] = useState(false);
  const [schedulesList, setSchedulesList] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [activeCrew, setActiveCrew] = useState<{
    id: string;
    name: string;
    role: string;
    phone?: string;
    type: 'lead' | 'helper' | 'casual';
  }[]>([]);
  const [loadingCrew, setLoadingCrew] = useState(false);

  // Preferences Feature
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);


  const fetchLeaveRequests = async () => {
    setLeaveLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('leaves')
        .select('*')
        .eq('technician_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setLeaveRequests(data);
    }
    setLeaveLoading(false);
  };

  const submitLeaveRequest = async () => {
      if (!newLeaveStartDate || !newLeaveEndDate || !newLeaveReason.trim()) {
        safeAlert('Error', 'Please fill in all required fields (Start Date, End Date, Reason).');
        return;
      }
      if (newLeaveType === 'sick' && !leaveFile) {
        safeAlert('Error', 'Medical Certificate is required for Sick Leave.');
        return;
      }
      if (leaveFile && leaveFile.size > 5 * 1024 * 1024) {
        safeAlert('Error', 'Medical Certificate must be less than 5MB.');
        return;
      }

      if (!newLeaveStartDate || !newLeaveEndDate || !newLeaveReason) {
      safeAlert('Error', 'Please fill in all fields (Start Date, End Date, Reason).');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('leaves')
        .insert({
          technician_id: user.id,
          leave_type: newLeaveType,
          start_date: newLeaveStartDate,
          end_date: newLeaveEndDate,
          reason: newLeaveReason,
          status: 'pending'
        });

      if (error) {
        safeAlert('Error', 'Failed to submit leave request: ' + error.message);
      } else {
        safeAlert('Success', 'Leave request submitted successfully.');
        setCreateLeaveMode(false);
        setNewLeaveStartDate('');
        setNewLeaveEndDate('');
        setNewLeaveReason('');
        setNewLeaveType('vacation');
          setLeaveFile(null);
        fetchLeaveRequests();
      }
    }
  };

  const fetchTimeLogs = async () => {
    setTimesheetLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('technician_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setTimeLogs(data);
    }
    setTimesheetLoading(false);
  };

  const handleDisputeTimeLog = (log?: any) => {
    if (log) {
      // Specific time log selected
      const logDateRaw = log.created_at || log.app_time_in;
      const formattedDate = logDateRaw 
        ? new Date(logDateRaw).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : 'Selected Shift';
      const logDateIso = logDateRaw ? new Date(logDateRaw).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      const timeInStr = log.app_time_in 
        ? new Date(log.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Not Logged';
      const timeOutStr = log.app_time_out 
        ? new Date(log.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Ongoing / Missing';
      const hoursStr = log.total_hours ? `${log.total_hours} hrs` : 'Incomplete';
      const shortId = log.id ? log.id.slice(0, 8) : '';

      const queryText = `Dispute Time Log [#${shortId}]: On ${formattedDate}, my recorded shift was Time In: ${timeInStr}, Time Out: ${timeOutStr} (${hoursStr}). Reason for dispute: `;

      setAiInitialQuery(queryText);
      setAiInitialTicketData({
        category: 'DTR Issue',
        logId: log.id,
        logDate: logDateIso,
        recordedIn: timeInStr,
        recordedOut: timeOutStr,
        expectedIn: timeInStr !== 'Not Logged' ? timeInStr : '08:00 AM',
        expectedOut: '05:00 PM',
        totalHours: log.total_hours || 0,
        reason: queryText,
      });

      setSelectedTimeLog(null);
      setTimesheetModalVisible(false);
      setTimeout(() => {
        setSupportModalVisible(true);
      }, 350);
    } else {
      // Called from list view when no specific log is selected
      if (timeLogs && timeLogs.length > 0) {
        setShiftDisputeModalVisible(true);
      } else {
        handleDisputeMissingShift();
      }
    }
  };

  const handleSelectShiftToDispute = (log: any) => {
    setShiftDisputeModalVisible(false);
    handleDisputeTimeLog(log);
  };

  const handleDisputeMissingShift = () => {
    const today = new Date().toISOString().split('T')[0];
    const queryText = `I would like to file an attendance dispute for an unrecorded shift on ${today}. My shift is missing from my timesheets. Reason for dispute: `;
    setAiInitialQuery(queryText);
    setAiInitialTicketData({
      category: 'DTR Issue',
      logDate: today,
      expectedIn: '08:00 AM',
      expectedOut: '05:00 PM',
      reason: queryText,
    });
    setShiftDisputeModalVisible(false);
    setTimesheetModalVisible(false);
    setTimeout(() => {
      setSupportModalVisible(true);
    }, 350);
  };

  const fetchSchedulesList = async () => {
    setSchedulesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('schedules')
        .select(`
          *,
          senior_partner:profiles!senior_partner_id(id, full_name, contact_number),
          schedule_casual_helpers(
            id,
            casual_helpers(id, full_name, contact_number, daily_rate)
          )
        `)
        // No technician_id filter: the access rules only return jobs this person is on (lead or crew).
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false });
      
      if (data) setSchedulesList(data);
    }
    setSchedulesLoading(false);
  };

  const fetchDtrLogs = async () => {
    setDtrLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('technician_id', user.id)
        .order('app_time_in', { ascending: false });
      setDtrLogs(data || []);
    }
    setDtrLoading(false);
  };
  
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setLogoutModalVisible(false);
      setProfileModalVisible(false);
      if (Platform.OS === 'web') {
        window.location.href = '/';
      } else {
        try { await Updates.reloadAsync(); } catch (e) { router.replace('/'); }
      }
    } catch (err) {
      console.error(err);
      safeAlert('Error', 'Failed to log out.');
    }
  };
  
  const [locationStatus, setLocationStatus] = useState<'verifying' | 'success' | 'fallback'>('verifying');
  const [userLoc, setUserLoc] = useState<{lat: number; lon: number; isMocked?: boolean; accuracy?: number | null} | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  
  // Chunk 45: Clock-In Resilience & Fallback Error Modal
  const [clockInErrorModalVisible, setClockInErrorModalVisible] = useState(false);
  const [clockInErrorData, setClockInErrorData] = useState<{
    title: string;
    message: string;
    gpsStatus: 'ok' | 'failed';
    gpsInside: boolean; // true only when the phone was inside the work site's circle
    photoStatus: 'captured' | 'failed' | 'skipped';
    syncStatus: 'saved_on_phone' | 'not_sent';
  }>({
    title: "Time-in not sent yet",
    message: "We couldn't send your time-in.",
    gpsStatus: 'ok',
    gpsInside: false,
    photoStatus: 'captured',
    syncStatus: 'not_sent'
  });
  const [lastCapturedSelfieUri, setLastCapturedSelfieUri] = useState<string | null>(null);
  const [retryingClockIn, setRetryingClockIn] = useState(false);
  const [submittingReviewTicket, setSubmittingReviewTicket] = useState(false);

  // Task 28: Stale Shift Lifecycle & Offline Queue Reconciler
  const [staleShiftModalVisible, setStaleShiftModalVisible] = useState(false);
  const [staleShiftData, setStaleShiftData] = useState<any | null>(null);
  const [resolvingStaleShift, setResolvingStaleShift] = useState(false);
  const [staleDepartureTime, setStaleDepartureTime] = useState('17:00');
  const [showStaleCustomPicker, setShowStaleCustomPicker] = useState(false);
  const [staleCustomPickerDate, setStaleCustomPickerDate] = useState<Date>(new Date());
  const [isCustomStaleTimeSelected, setIsCustomStaleTimeSelected] = useState(false);

  const stalePunchStart = useMemo(() => {
    if (!staleShiftData) return null;
    return new Date(staleShiftData.app_time_in || staleShiftData.created_at);
  }, [staleShiftData]);

  const dynamicStalePresets = useMemo(() => {
    // Quick choices: 5, 6 and 7 PM (work ends at 5 PM). If they timed in late in the day,
    // offer 9, 10 and 11 hours after time-in instead.
    const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const label = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const base = stalePunchStart ?? new Date(new Date().setHours(8, 0, 0, 0));
    const at = (h: number) => new Date(new Date(base).setHours(h, 0, 0, 0));
    const choices = base.getHours() < 15
      ? [at(17), at(18), at(19)]
      : [9, 10, 11].map(h => new Date(base.getTime() + h * 60 * 60 * 1000));
    return choices.map(d => ({ label: label(d), time: fmt(d) }));
  }, [stalePunchStart]);

  const staleShiftPreview = useMemo(() => {
    if (!stalePunchStart) return null;
    const timeStr = staleDepartureTime || '17:00';
    const [hoursStr, minsStr] = timeStr.split(':');
    const outDate = new Date(stalePunchStart);
    outDate.setHours(parseInt(hoursStr || '17', 10), parseInt(minsStr || '0', 10), 0, 0);

    let outMs = outDate.getTime();
    if (outMs <= stalePunchStart.getTime()) {
      outMs += 24 * 60 * 60 * 1000;
    }

    const diffMs = outMs - stalePunchStart.getTime();
    const grossHours = diffMs / (1000 * 60 * 60);
    const mealDeduction = grossHours > 5 ? 1 : 0;
    const netHours = Math.round(Math.max(0, grossHours - mealDeduction) * 10) / 10;
    const endDate = new Date(outMs);
    const isValid = grossHours > 0 && grossHours <= 24;
    const isExceedinglyLong = grossHours > 16;

    return {
      punchStart: stalePunchStart,
      endDate,
      timeStr,
      grossHours: Math.round(grossHours * 10) / 10,
      mealDeduction,
      netHours,
      isValid,
      isExceedinglyLong,
    };
  }, [stalePunchStart, staleDepartureTime]);


  const [profile, setProfile] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);

  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadData() {
        (async () => { 
          try { 
            const { status } = await Location.requestForegroundPermissionsAsync(); 
            if (status === 'granted') { 
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); 
              setUserLoc({ 
                lat: loc.coords.latitude, 
                lon: loc.coords.longitude, 
                isMocked: !!(loc as any).mocked, 
                accuracy: loc.coords.accuracy ?? null 
              }); 
            } 
          } catch (e) {} 
        })();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profileData);
      fetchPoliciesAndAcks(user.id);

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select(`
          *,
          senior_partner:profiles!senior_partner_id(id, full_name, contact_number),
          schedule_casual_helpers(
            id,
            casual_helpers(id, full_name, contact_number, daily_rate)
          )
        `)
        // No technician_id filter: the access rules only return jobs this person is on (lead or crew).
        // Today's job, or the next one: the first job that hasn't ended before today (Manila).
        .neq('status', 'cancelled')
        .or(`end_time.gte.${manilaTodayStartIso()},start_time.gte.${manilaTodayStartIso()}`)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      setSchedule(scheduleData || null);

      // Reactive Sync: Flush pending offline queue to HQ
      try {
        syncQueue.syncPendingQueue().then(res => {
          if (res.syncedCount > 0) {
            console.log(`[OFFLINE SYNC] Flushed ${res.syncedCount} queued punch(es) to HQ.`);
          }
        }).catch(() => {});
      } catch (sqErr) {}

      // Check today's attendance logs boundary
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Check for any stale unclosed shift from previous days
      const { data: openLogs } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('technician_id', user.id)
        .is('app_time_out', null)
        .order('created_at', { ascending: false });

      const staleUnclosed = openLogs?.find(l => {
        const punchStart = new Date((l.app_time_in || l.created_at) as string);
        return punchStart.getTime() < startOfDay.getTime();
      });

      if (staleUnclosed) {
        setStaleShiftData(staleUnclosed);
        const punchStart = new Date((staleUnclosed.app_time_in || staleUnclosed.created_at) as string);
        // Pre-select the first quick choice: 5 PM, or 9 hours after a late-day time-in.
        const defEnd = punchStart.getHours() < 15
          ? new Date(new Date(punchStart).setHours(17, 0, 0, 0))
          : new Date(punchStart.getTime() + 9 * 60 * 60 * 1000);
        const defTime = `${String(defEnd.getHours()).padStart(2, '0')}:${String(defEnd.getMinutes()).padStart(2, '0')}`;
        setStaleDepartureTime(defTime);
        setStaleCustomPickerDate(defEnd);
        setIsCustomStaleTimeSelected(false);
        setStaleShiftModalVisible(true);
      }
      
      const { data: todaysLogs } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('technician_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (todaysLogs && todaysLogs.length > 0) {
        setHasClockedInToday(true);
        const ongoing = todaysLogs.find(l => !l.app_time_out);
        if (ongoing) {
          setActiveTimeLog(ongoing);
          setTodayCompletedLog(null);
        } else {
          setActiveTimeLog(null);
          setTodayCompletedLog(todaysLogs[0]);
        }
      } else {
        setHasClockedInToday(false);
        setActiveTimeLog(null);
        setTodayCompletedLog(null);
      }

      fetchNotifications();
    }
    loadData();

    // In-App Notification Center Realtime Listener
    const notifChannel = supabase.channel('mobile-notifications-hub')
      .on('broadcast', { event: 'new_comment' }, () => {
        fetchNotifications();
      })
      .on('broadcast', { event: 'ticket_update' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments' }, (payload: any) => {
        if (payload.new?.sender_role === 'admin' || payload.new?.sender_role === 'system') {
          fetchNotifications();
          try {
            // Not available in Expo Go on Android (see lib/notifications); skipped there.
            getNotifications()?.scheduleNotificationAsync({
              content: {
                title: 'TechnoCycle HR Update',
                body: (payload.new.content || '').replace(/\[DECISION:.*?\]\s*/i, '').slice(0, 100),
                data: { ticketId: payload.new.ticket_id },
              },
              trigger: null,
            });
          } catch (e) {}
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        loadData();
        fetchSchedulesList();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, []);

  // Task 28: Reactive Offline Queue Flush on Screen Focus
  useFocusRefresh(() => {
      syncQueue.syncPendingQueue().then(res => {
        if (res.syncedCount > 0) {
          console.log(`[FOCUS SYNC] Synchronized ${res.syncedCount} queued punch(es) to HQ.`);
        }
      }).catch(err => {
        console.warn("Focus sync error:", err);
      });
      fetchPoliciesAndAcks();
  });

  // Task 28: Stale Shift Reconciler Action
  const handleResolveStaleShift = async (customDepartureTime?: string) => {
    if (!staleShiftData || !profile?.id) return;
    setResolvingStaleShift(true);
    try {
      const punchStart = new Date(staleShiftData.app_time_in || staleShiftData.created_at);
      const timeStr = customDepartureTime || staleDepartureTime || '17:00';
      const [hoursStr, minsStr] = timeStr.split(':');
      
      const outDate = new Date(punchStart);
      outDate.setHours(parseInt(hoursStr, 10), parseInt(minsStr || '0', 10), 0, 0);

      let outMs = outDate.getTime();
      if (outMs <= punchStart.getTime()) {
        outMs += 24 * 60 * 60 * 1000;
      }

      const diffMs = outMs - punchStart.getTime();
      if (diffMs <= 0) {
        safeAlert("Invalid Departure Time", "Departure time cannot be equal to or earlier than clock-in time.");
        setResolvingStaleShift(false);
        return;
      }

      const grossHours = diffMs / (1000 * 60 * 60);
      if (grossHours > 24) {
        safeAlert("Invalid Duration", "A single shift cannot exceed 24 hours. Please contact HR for manual timesheet correction.");
        setResolvingStaleShift(false);
        return;
      }

      const netHours = grossHours > 5 ? Math.max(0, grossHours - 1) : grossHours;
      const totalHours = Math.round(netHours * 10) / 10;
      const outIso = new Date(outMs).toISOString();

      // Only the time-out may be set by a technician (guard_attendance_changes).
      // 'pending_close' tells HR this time-out was typed in later and needs a check.
      const { error: updateErr } = await supabase
        .from('attendance_logs')
        .update({
          app_time_out: outIso,
          total_hours: totalHours,
          status: 'pending_close',
        })
        .eq('id', staleShiftData.id);

      if (updateErr) throw updateErr;

      // Mark the live map pin as offline
      await supabase
        .from('live_locations')
        .update({ status: 'offline', updated_at: outIso })
        .eq('technician_id', profile.id);

      setStaleShiftModalVisible(false);
      setStaleShiftData(null);
      safeAlert(
        "Time-out saved",
        `${punchStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: you left at ${timeStr} (${totalHours} h). HR will check it.`
      );
    } catch (err: any) {
      console.error("Failed to resolve stale shift:", err);
      safeAlert("Not saved", "Couldn't save your time-out. Check your signal and try again.");
    } finally {
      setResolvingStaleShift(false);
    }
  };

  // Duty-Bound Live Fleet Tracking: Periodic GPS Heartbeat
  // Active strictly when technician is clocked in with an open shift (app_time_out is null)
  useEffect(() => {
    if (!activeTimeLog || activeTimeLog.app_time_out || !profile?.id) {
      return;
    }

    const techId = profile.id;
    let isMounted = true;

    const sendHeartbeat = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isMounted) return;

        const nowIso = new Date().toISOString();
        const lat = loc.coords.latitude;
        const lon = loc.coords.longitude;

        // 1. Dual-stream upsert into technician_locations with active working status
        await supabase
          .from('live_locations')
          .upsert({
            technician_id: techId,
            latitude: lat,
            longitude: lon,
            status: 'working',
            updated_at: nowIso,
          });

        // 2. Realtime broadcast to admin fleet tracking radar
        const trackingChannel = supabase.channel('fleet-tracking');
        await trackingChannel.send({
          type: 'broadcast',
          event: 'location_update',
          payload: {
            technician_id: techId,
            full_name: profile.full_name || 'Technician',
            latitude: lat,
            longitude: lon,
            status: 'working',
            action: 'heartbeat',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        });
      } catch (err) {
        // Non-fatal: background GPS blip or timeout
        console.warn('[DutyHeartbeat] Location ping skipped:', err);
      }
    };

    // Immediate initial sync on active shift, followed by 60s periodic ping
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTimeLog?.id, activeTimeLog?.app_time_out, profile?.id, profile?.full_name]);

  // Everyone on the open job: lead, crew from the coordinator, temporary helpers (lib/crew.ts)
  useEffect(() => {
    const targetSched = selectedSchedule || (dispatchVisible ? schedule : null);
    if (!targetSched?.id) {
      setActiveCrew([]);
      return;
    }

    let isMounted = true;
    setLoadingCrew(true);
    getJobCrew(targetSched, profile?.id)
      .then(members => { if (isMounted) setActiveCrew(members); })
      .catch(err => console.warn('Error loading active crew:', err))
      .finally(() => { if (isMounted) setLoadingCrew(false); });

    return () => { isMounted = false; };
  }, [selectedSchedule, dispatchVisible, schedule, profile?.id]);

  // The Me tab and Techy open features that still live here (lib/homeActions.ts)
  useEffect(() => onHomeAction((action) => {
    switch (action) {
      case 'tools': router.push('/tools' as Href); break;
      case 'support': fetchTickets(); setSupportModalVisible(true); break;
      case 'fileLeave': router.push('/leave-new' as Href); break;
      case 'leaves': router.push('/leave' as Href); break;
      case 'updates': router.push('/updates' as Href); break;
      case 'notifications': setNotifVisible(true); break;
      case 'timesheets': fetchTimeLogs(); setTimesheetModalVisible(true); break;
      case 'forms': fetchPoliciesAndAcks(); setFormsModalVisible(true); break;
      case 'preferences': setPreferencesModalVisible(true); break;
      case 'logout': setLogoutModalVisible(true); break;
      case 'clockIn': handleClockIn(); break;
    }
  }));

  const openMenu = () => { setMenuVisible(true); };

  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.poly(4)), useNativeDriver: true }).start(() => setMenuVisible(false));
  };

  const resolveTargetGeofence = async (): Promise<{ name: string; lat: number; lon: number; radius: number }> => {
    // 1. If active dispatch schedule exists with valid coordinates, use it as primary target
    if (schedule?.geofence_lat && schedule?.geofence_lon) {
      return {
        name: schedule.client_name || 'Assigned Dispatch Site',
        lat: Number(schedule.geofence_lat),
        lon: Number(schedule.geofence_lon),
        radius: Number(schedule.geofence_radius) || 100,
      };
    }

    // 2. Cascade to active company branches from office_locations
    try {
      const { data: offices } = await supabase
        .from('office_locations')
        .select('id, name, latitude, longitude, radius_meters')
        .eq('is_active', true);

      if (offices && offices.length > 0) {
        if (userLoc) {
          let nearest = offices[0];
          let minDistance = Infinity;

          for (const office of offices) {
            const dist = getDistance(
              { latitude: userLoc.lat, longitude: userLoc.lon },
              { latitude: Number(office.latitude), longitude: Number(office.longitude) }
            );
            if (dist < minDistance) {
              minDistance = dist;
              nearest = office;
            }
          }

          return {
            name: nearest.name,
            lat: Number(nearest.latitude),
            lon: Number(nearest.longitude),
            radius: Number(nearest.radius_meters) || 100,
          };
        } else {
          return {
            name: offices[0].name,
            lat: Number(offices[0].latitude),
            lon: Number(offices[0].longitude),
            radius: Number(offices[0].radius_meters) || 100,
          };
        }
      }
    } catch (e) {
      console.warn('Error resolving office locations:', e);
    }

    // 3. Fallback default to TechnoCycle Main Office
    return {
      name: 'TechnoCycle Main Office',
      lat: 14.5995,
      lon: 120.9842,
      radius: 100,
    };
  };

  const handleClockIn = async () => {
    if (activeTimeLog) {
      safeAlert("Active Shift", "You already have an active shift in progress. Please clock out before starting a new session.");
      return;
    }

    setClockInModal(true);
    setLocationStatus('verifying');
    // Set once the phone is confirmed inside the site, so a failed send can be queued for later.
    let insideLoc: { lat: number; lon: number; isMocked: boolean; accuracy: number | null } | null = null;

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        safeAlert("Permission Required", "High-accuracy location access is required to verify clock-in.");
        setLocationStatus('fallback');
        return;
      }

      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch (err) {
        location = await Location.getLastKnownPositionAsync();
      }

      if (!location) {
        safeAlert("GPS Unavailable", "Could not acquire GPS position. Please ensure device location is enabled.");
        setLocationStatus('fallback');
        return;
      }

      const isMocked = !!(location as any).mocked;
      const accuracy = location.coords.accuracy ?? null;

      // Active root/jailbreak detection via native expo-device API
      let isRooted = false;
      try {
        isRooted = await Device.isRootedExperimentalAsync();
      } catch (rootErr) {
        console.warn("Hardware root detection check error:", rootErr);
      }

      const currentLoc = { 
        lat: location.coords.latitude, 
        lon: location.coords.longitude,
        isMocked,
        accuracy
      };
      setUserLoc(currentLoc);
      
      const target = await resolveTargetGeofence();
      setTargetGeofence(target);

      const distance = getDistance(
        { latitude: currentLoc.lat, longitude: currentLoc.lon },
        { latitude: target.lat, longitude: target.lon }
      );

      const techId = profile?.id;

      // Anti-Spoofing Interception: Mocked GPS is strictly prohibited from auto-verification
      if (isMocked) {
        console.warn("[ANTI-SPOOF] Simulated GPS provider intercepted. Bypassing automatic geofence clearance.");
        safeAlert(
          "Mock Location Detected",
          "Simulated GPS coordinates have been detected on this device. Automated clock-in is disabled. You must submit a photo verification for HR audit."
        );
        setLocationStatus('fallback');
        return;
      }

      if (distance <= target.radius) {
        insideLoc = currentLoc;
        const punchId = generateUUID();
        // --- 1. INSERT TIME LOG (Server-authoritative time via Postgres default timezone('utc', now())) ---
        const { data: insertedLog, error: logError } = await supabase
          .from('attendance_logs')
          .insert({
            id: punchId,
            technician_id: techId,
            latitude: currentLoc.lat,
            longitude: currentLoc.lon,
            status: 'active',
            geofence_status: 'inside',
            is_mocked: false,
            gps_accuracy: accuracy,
            is_suspicious: isRooted,
            is_manual_entry: false,
            device_id: await getDeviceId(), // must be the registered phone (check_registered_phone)
          })
          .select()
          .single();

        if (logError) throw logError;

        const serverPunchTime = insertedLog?.app_time_in || new Date().toISOString();

        // --- 2. DUAL-STREAM: UPSERT TECHNICIAN LOCATIONS ---
        if (techId) {
          await supabase
            .from('live_locations')
            .upsert({
              technician_id: techId,
              latitude: currentLoc.lat,
              longitude: currentLoc.lon,
              status: 'working',
              updated_at: serverPunchTime,
            });

          // --- 3. REALTIME BROADCAST TO ADMIN ---
          const trackingChannel = supabase.channel('fleet-tracking');
          await trackingChannel.send({
            type: 'broadcast',
            event: 'location_update',
            payload: {
              technician_id: techId,
              full_name: profile?.full_name || 'Technician',
              latitude: currentLoc.lat,
              longitude: currentLoc.lon,
              status: 'working',
              action: 'clock_in',
              time: new Date(serverPunchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          });
        }

        setLocationStatus('success');
        techy.react('cheer');
        setHasClockedInToday(true);
        setActiveTimeLog(insertedLog);
        setTodayCompletedLog(null);
        setTimeout(() => {
          setClockInModal(false);
          // Hybrid Post-Punch Gate: check if unacknowledged mandatory policies exist
          if (unacknowledgedPolicies.length > 0) {
            setPolicyEnforcementReason('post_punch');
            setTimeout(() => setPolicyEnforcementVisible(true), 400);
          }
        }, 1800);
      } else {
        // Outside target radius -> fallback to map & photo override
        setLocationStatus('fallback');
      }
    } catch (e: any) {
      console.error("Clock in error:", e);
      if (isWrongPhoneError(e)) {
        setClockInModal(false);
        safeAlert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
        return;
      }
      // Inside the site but the send failed (usually no signal): keep the punch on the phone.
      let queued = false;
      if (profile?.id && insideLoc) {
        try {
          const offlinePunchId = generateUUID();
          await syncQueue.addToQueue('time_in', {
            id: offlinePunchId,
            technician_id: profile.id,
            latitude: insideLoc.lat,
            longitude: insideLoc.lon,
            geofence_status: 'inside',
            is_mocked: !!insideLoc.isMocked,
            gps_accuracy: insideLoc.accuracy ?? null,
            status: 'active',
            is_manual_entry: false,
            device_id: await getDeviceId(), // must be the registered phone (check_registered_phone)
          });
          queued = true;
        } catch (queueErr) {
          console.error("Failed to enqueue offline punch:", queueErr);
        }
      }
      setClockInErrorData({
        title: queued ? 'No signal' : "Time-in not sent",
        message: queued
          ? "Your time-in is saved on this phone. It will be sent by itself when you have signal."
          : "We couldn't record your time-in. Check your signal and location, then try again.",
        gpsStatus: insideLoc ? 'ok' : 'failed',
        gpsInside: !!insideLoc,
        photoStatus: 'skipped',
        syncStatus: queued ? 'saved_on_phone' : 'not_sent'
      });
      setClockInErrorModalVisible(true);
      setLocationStatus('fallback');
    }
  };

  const handleVisualOverride = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      safeAlert('Permission Denied', 'Camera access is required for visual override.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.3, // Compressed to ~60KB to eliminate slow-network/basement timeouts
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0].uri) {
      setLastCapturedSelfieUri(result.assets[0].uri);
      setUploadingSelfie(true);

      const techId = profile?.id;
      const currentLoc = userLoc || { lat: 0, lon: 0 };
      const isMocked = !!userLoc?.isMocked;
      const accuracy = userLoc?.accuracy ?? null;

      let isRooted = false;
      try {
        isRooted = await Device.isRootedExperimentalAsync();
      } catch (rErr) {}

      const photoPunchId = generateUUID();
      try {
        const fileExt = result.assets[0].uri.split('.').pop() || 'jpeg';
        const fileName = `${profile?.id}-${Date.now()}.${fileExt}`;

        // dtr-selfies is a private bucket: we save the file's path, and the office opens it with a signed link.
        await uploadPhoto('dtr-selfies', fileName, result.assets[0].uri);

        // 1. Time-in outside the site, with selfie for HR to check (photo_status 'pending'); server sets the time
        const { data: insertedLog, error: logError } = await supabase
          .from('attendance_logs')
          .insert({
            id: photoPunchId,
            technician_id: techId,
            latitude: currentLoc.lat,
            longitude: currentLoc.lon,
            status: 'active',
            geofence_status: 'outside',
            photo_url: fileName,
            photo_status: 'pending',
            is_mocked: isMocked,
            gps_accuracy: accuracy,
            is_suspicious: isRooted || isMocked,
            is_manual_entry: false,
            device_id: await getDeviceId(), // must be the registered phone (check_registered_phone)
          })
          .select()
          .single();

        if (logError) throw logError;

        const serverPunchTime = insertedLog?.app_time_in || new Date().toISOString();

        // 2. Dual stream: upsert technician locations
        if (techId) {
          await supabase
            .from('live_locations')
            .upsert({
              technician_id: techId,
              latitude: currentLoc.lat,
              longitude: currentLoc.lon,
              status: 'working',
              updated_at: serverPunchTime,
            });

          // 3. Realtime broadcast to admin
          const trackingChannel = supabase.channel('fleet-tracking');
          await trackingChannel.send({
            type: 'broadcast',
            event: 'location_update',
            payload: {
              technician_id: techId,
              full_name: profile?.full_name || 'Technician',
              latitude: currentLoc.lat,
              longitude: currentLoc.lon,
              status: 'working',
              action: 'clock_in_override',
              time: new Date(serverPunchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          });
        }

        safeAlert('Timed in', 'Your time-in and selfie were sent. HR will check them because you were outside the site.');
        techy.react('cheer');
        setClockInModal(false);
        setHasClockedInToday(true);
        setActiveTimeLog(insertedLog);
        setTodayCompletedLog(null);
        if (unacknowledgedPolicies.length > 0) {
          setPolicyEnforcementReason('post_punch');
          setTimeout(() => setPolicyEnforcementVisible(true), 500);
        }
      } catch (err: any) {
        console.error("Photo override error:", err);
        if (isWrongPhoneError(err)) {
          setUploadingSelfie(false);
          setClockInModal(false);
          safeAlert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
          return;
        }
        // Not queued: a time-in outside the site needs its selfie, so the photo is kept
        // on the phone and "Try again" sends both together. (Never show the raw error.)
        setClockInErrorData({
          title: "Selfie not sent",
          message: "Your selfie is saved on this phone but didn't reach HR. Check your signal and tap Try again, or tell HR instead.",
          gpsStatus: userLoc ? 'ok' : 'failed',
          gpsInside: false,
          photoStatus: 'captured',
          syncStatus: 'not_sent'
        });
        setClockInErrorModalVisible(true);
      }
      setUploadingSelfie(false);
    }
  };

  const retryVisualOverrideSubmission = async () => {
    if (!lastCapturedSelfieUri) {
      setClockInErrorModalVisible(false);
      handleVisualOverride();
      return;
    }

    setRetryingClockIn(true);
    const techId = profile?.id;
    const currentLoc = userLoc || { lat: 0, lon: 0 };
    const isMocked = !!userLoc?.isMocked;
    const accuracy = userLoc?.accuracy ?? null;

    let isRooted = false;
    try {
      isRooted = await Device.isRootedExperimentalAsync();
    } catch (rErr) {}

    try {
      const fileExt = lastCapturedSelfieUri.split('.').pop() || 'jpeg';
      const fileName = `${profile?.id}-${Date.now()}.${fileExt}`;
      await uploadPhoto('dtr-selfies', fileName, lastCapturedSelfieUri);

      const { data: insertedLog, error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          technician_id: techId,
          latitude: currentLoc.lat,
          longitude: currentLoc.lon,
          status: 'active',
          geofence_status: 'outside',
          photo_url: fileName,
          photo_status: 'pending',
          is_mocked: isMocked,
          gps_accuracy: accuracy,
          is_suspicious: isRooted || isMocked,
          is_manual_entry: false,
          device_id: await getDeviceId(), // must be the registered phone (check_registered_phone)
        })
        .select()
        .single();

      if (logError) throw logError;

      const serverPunchTime = insertedLog?.app_time_in || new Date().toISOString();

      if (techId) {
        await supabase
          .from('live_locations')
          .upsert({
            technician_id: techId,
            latitude: currentLoc.lat,
            longitude: currentLoc.lon,
            status: 'working',
            updated_at: serverPunchTime,
          });

        const trackingChannel = supabase.channel('fleet-tracking');
        await trackingChannel.send({
          type: 'broadcast',
          event: 'location_update',
          payload: {
            technician_id: techId,
            full_name: profile?.full_name || 'Technician',
            latitude: currentLoc.lat,
            longitude: currentLoc.lon,
            status: 'working',
            action: 'clock_in_override',
            time: new Date(serverPunchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        });
      }

      setClockInErrorModalVisible(false);
      setClockInModal(false);
      setHasClockedInToday(true);
      setActiveTimeLog(insertedLog);
      setTodayCompletedLog(null);
      safeAlert('Timed in', 'Your time-in and selfie were sent. HR will check them because you were outside the site.');
      techy.react('cheer');
    } catch (err: any) {
      console.error("Retry failed:", err);
      if (isWrongPhoneError(err)) {
        setClockInErrorModalVisible(false);
        setClockInModal(false);
        safeAlert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
        return;
      }
      safeAlert('Still not sent', "Your selfie still didn't go through. Tap \"Tell HR instead\" so HR knows you came to work.");
    } finally {
      setRetryingClockIn(false);
    }
  };

  const submitReviewTicket = async () => {
    if (!profile?.id) return;
    setSubmittingReviewTicket(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const currentLoc = userLoc ? `${userLoc.lat.toFixed(5)}, ${userLoc.lon.toFixed(5)}` : 'not available';

      const { error } = await supabase
        .from('tickets')
        .insert({
          employee_id: profile.id,
          category: 'DTR Issue',
          title: `Couldn't time in: ${profile.full_name || 'Technician'}`,
          description: `I tried to time in at ${timeStr} but my selfie wouldn't send. My location: ${currentLoc}. Please check my attendance for today.`,
          priority: 'medium',
          status: 'open'
        });

      if (error) throw error;

      setClockInErrorModalVisible(false);
      setClockInModal(false);
      safeAlert(
        'Sent to HR',
        'HR knows you tried to time in at this time and will check your attendance.'
      );
    } catch (err: any) {
      console.error("Failed to submit review ticket:", err);
      safeAlert('Not sent', "Couldn't reach HR. Please call or text your coordinator.");
    } finally {
      setSubmittingReviewTicket(false);
    }
  };

  const handleClockOut = () => {
    if (!activeTimeLog) return;

    const shiftStart = new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    Alert.alert(
      "Confirm Clock Out",
      `Are you sure you want to end your shift?\n(Started at ${shiftStart}${elapsedShiftTime ? ` • Duration: ${elapsedShiftTime}` : ''})`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clock Out Now", 
          style: "destructive",
          onPress: async () => {
            setClockingOut(true);
            try {
              let exitLoc = userLoc;
              try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                exitLoc = { lat: loc.coords.latitude, lon: loc.coords.longitude };
              } catch (e) {}

              // 1. Authoritative server time via get_server_time RPC with fallback
              let authoritativeOut = new Date().toISOString();
              let isSuspiciousOut = false;
              try {
                const { data: sTime, error: sErr } = await supabase.rpc('get_server_time');
                if (!sErr && sTime) {
                  authoritativeOut = new Date(sTime).toISOString();
                  const skewMs = Math.abs(new Date().getTime() - new Date(sTime).getTime());
                  if (skewMs > 5 * 60 * 1000) {
                    console.warn(`[CLOCK INTEGRITY] Device clock skew of ${Math.round(skewMs / 1000)}s detected on clock out.`);
                    isSuspiciousOut = true;
                  }
                }
              } catch (clockErr) {
                console.warn("Could not fetch server time for clock out:", clockErr);
              }

              const startMs = new Date(activeTimeLog.app_time_in).getTime();
              const endMs = new Date(authoritativeOut).getTime();
              const diffMs = Math.max(0, endMs - startMs);
              const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
              const techId = profile?.id;

              // 2. Update time_logs with app_time_out and total_hours
              // Technicians can't set review flags (guard_attendance_changes), so a time-out
              // with a wrong phone clock is marked 'pending_close' for HR to check.
              const updatePayload = {
                app_time_out: authoritativeOut,
                total_hours: totalHours,
                status: isSuspiciousOut ? 'pending_close' : 'closed',
              };

              const { error: logErr } = await supabase
                .from('attendance_logs')
                .update(updatePayload)
                .eq('id', activeTimeLog.id);

              if (logErr) {
                // Offline fallback
                try {
                  await syncQueue.addToQueue('time_out', {
                    log_id: activeTimeLog.id,
                    app_time_out: authoritativeOut,
                    total_hours: totalHours,
                  });
                } catch (queueErr) {
                  console.error("Failed to enqueue offline clock-out:", queueErr);
                }
              }

              // 3. Update technician_locations to offline
              if (techId) {
                await supabase
                  .from('live_locations')
                  .upsert({
                    technician_id: techId,
                    latitude: exitLoc?.lat || 0,
                    longitude: exitLoc?.lon || 0,
                    status: 'offline',
                    updated_at: authoritativeOut
                  });

                // 4. Broadcast clock_out to admin
                const trackingChannel = supabase.channel('fleet-tracking');
                await trackingChannel.send({
                  type: 'broadcast',
                  event: 'location_update',
                  payload: {
                    technician_id: techId,
                    full_name: profile?.full_name || 'Technician',
                    latitude: exitLoc?.lat || 0,
                    longitude: exitLoc?.lon || 0,
                    status: 'offline',
                    action: 'clock_out',
                    time: new Date(authoritativeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                });
              }

              techy.react('wave');
              safeAlert(
                "Shift Ended",
                `You have successfully clocked out. Total logged time: ${totalHours} hours. Attendance synced with HQ.`
              );

              setTodayCompletedLog({
                ...activeTimeLog,
                app_time_out: authoritativeOut,
                total_hours: totalHours
              });
              setActiveTimeLog(null);
            } catch (err: any) {
              console.error("Clock out error:", err);
              safeAlert("Clock Out Failed", err.message || "Failed to log clock out. Please check your connection.");
            } finally {
              setClockingOut(false);
            }
          }
        }
      ]
    );
  };

  return (
    <GlowScreen>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HomeBody
          unread={unreadCount}
          onBell={() => setNotifVisible(true)}
          shift={activeTimeLog
            ? { kind: 'working', startedAt: activeTimeLog.app_time_in, verified: activeTimeLog.geofence_status === 'inside' }
            : todayCompletedLog
            ? { kind: 'done', timeIn: todayCompletedLog.app_time_in, timeOut: todayCompletedLog.app_time_out, hours: todayCompletedLog.total_hours != null ? Number(todayCompletedLog.total_hours) : null }
            : { kind: 'off', shiftStart: schedule?.start_time }}
          busy={clockingOut}
          onTimeIn={handleClockIn}
          onTimeOut={handleClockOut}
          job={schedule}
          onRefresh={async () => { await fetchNotifications(); }}
        />

        {/* VERIFICATION MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={clockInModal}   onBackdropPress={() => setClockInModal(false)} onBackButtonPress={() => setClockInModal(false)} onSwipeComplete={() => setClockInModal(false)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.verificationOverlay}>
            <View style={styles.verificationCard}>
              {locationStatus === 'verifying' ? (
                <View style={styles.verifyingState}>
                  <ActivityIndicator size="large" color={BRAND.blue} />
                  <Text style={styles.verifyingText}>Acquiring GPS Signal...</Text>
                </View>
              ) : locationStatus === 'success' ? (
                <View style={styles.verifyingState}>
                  <Feather name="check-circle" size={48} color={BRAND.green} />
                  <Text style={styles.verifyingText}>Clock In Verified!</Text>
                </View>
              ) : (
                <View style={styles.fallbackState}>
                  <View style={styles.fallbackHeader}>
                    <Text style={styles.fallbackTitle}>Location Proximity</Text>
                    <TouchableOpacity onPress={() => setClockInModal(false)}>
                      <Feather name="x" size={24} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {(() => {
                    const targetLat = targetGeofence?.lat ?? schedule?.geofence_lat;
                    const targetLon = targetGeofence?.lon ?? schedule?.geofence_lon;
                    const distM = (userLoc && targetLat && targetLon) 
                      ? getDistance(
                          { latitude: userLoc.lat, longitude: userLoc.lon },
                          { latitude: targetLat, longitude: targetLon }
                        )
                      : null;
                    const distText = distM != null ? (distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`) : null;
                    
                    return (
                      <>
                        <Text style={styles.fallbackSub}>
                          You are outside {targetGeofence?.name ? `"${targetGeofence.name}"` : 'the target green zone'}
                          {distText ? ` (~${distText} away)` : ''}.
                        </Text>
                        <View style={styles.mapContainer}>
                          {userLoc && (targetGeofence || schedule) && targetLat && targetLon && (
                            <>
                              <MapView
                                style={styles.map}
                                initialRegion={{
                                  latitude: (userLoc.lat + targetLat) / 2,
                                  longitude: (userLoc.lon + targetLon) / 2,
                                  latitudeDelta: Math.max(Math.abs(userLoc.lat - targetLat) * 2.2, 0.008),
                                  longitudeDelta: Math.max(Math.abs(userLoc.lon - targetLon) * 2.2, 0.008),
                                }}
                              >
                                <Circle
                                  center={{
                                    latitude: targetLat,
                                    longitude: targetLon,
                                  }}
                                  radius={targetGeofence?.radius ?? schedule?.geofence_radius ?? 100}
                                  strokeColor="rgba(16, 185, 129, 0.8)"
                                  fillColor="rgba(16, 185, 129, 0.25)"
                                />
                                <Marker
                                  coordinate={{
                                    latitude: targetLat,
                                    longitude: targetLon,
                                  }}
                                  title={targetGeofence?.name || schedule?.client_name || 'Target Zone'}
                                  description="Required geofence check-in perimeter"
                                  pinColor="#10B981"
                                />
                                <Marker
                                  coordinate={{ latitude: userLoc.lat, longitude: userLoc.lon }}
                                  title="Your Position"
                                  description={distText ? `${distText} from zone` : 'Current GPS location'}
                                  pinColor="#EF4444"
                                />
                              </MapView>

                              {/* Distance Badge */}
                              <View style={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                zIndex: 10,
                                elevation: 5
                              }}>
                                <Feather name="map-pin" size={13} color="#FBBF24" style={{ marginRight: 6 }} />
                                <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>
                                  {distText ? `${distText} outside zone` : 'Outside Geofence'}
                                </Text>
                              </View>

                              <NavigateButton lat={targetLat} lon={targetLon} address={schedule?.location} color={colors.brandBlue} />
                            </>
                          )}
                        </View>
                      </>
                    );
                  })()}
                  <TouchableOpacity style={[styles.fallbackBtn, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} onPress={handleVisualOverride} disabled={uploadingSelfie}>
                    {uploadingSelfie ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="camera" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.fallbackBtnText}>Submit Photo Override</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </RNModal>

        {/* CHUNK 45: CLOCK-IN FALLBACK & RESILIENCE ERROR MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
          isVisible={clockInErrorModalVisible}
          onBackdropPress={() => setClockInErrorModalVisible(false)}
          onBackButtonPress={() => setClockInErrorModalVisible(false)}
          style={{ margin: 20, justifyContent: 'center' }}
        >
          <View style={[styles.clockInErrorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Header Icon + Title */}
            <View style={styles.clockInErrorHeader}>
              <View style={[styles.clockInErrorIconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                <Feather name="alert-triangle" size={28} color={BRAND.red} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.clockInErrorTitle, { color: colors.text }]}>{clockInErrorData.title}</Text>
              </View>
            </View>

            {/* Message (plain words, never the raw error) */}
            <Text style={[styles.clockInErrorMessage, { color: colors.text }]}>
              {clockInErrorData.message}
            </Text>

            {/* What worked and what didn't */}
            <View style={[styles.clockInErrorStatusBox, { backgroundColor: isDark ? colors.subCard : '#F8FAFC', borderColor: colors.cardBorder }]}>
              <View style={styles.clockInStatusRow}>
                <Feather
                  name={clockInErrorData.gpsStatus === 'ok' ? 'check-circle' : 'x-circle'}
                  size={16}
                  color={clockInErrorData.gpsStatus === 'ok' ? BRAND.green : BRAND.red}
                />
                <Text style={[styles.clockInStatusText, { color: colors.text }]}>
                  {clockInErrorData.gpsStatus !== 'ok'
                    ? 'Location: not found'
                    : clockInErrorData.gpsInside
                    ? 'Location: at the work site'
                    : 'Location: outside the work site'}
                </Text>
              </View>

              {clockInErrorData.photoStatus === 'captured' && (
                <View style={styles.clockInStatusRow}>
                  <Feather name="check-circle" size={16} color={BRAND.green} />
                  <Text style={[styles.clockInStatusText, { color: colors.text }]}>Selfie: saved on this phone</Text>
                </View>
              )}

              <View style={styles.clockInStatusRow}>
                <Feather
                  name={clockInErrorData.syncStatus === 'saved_on_phone' ? 'clock' : 'alert-circle'}
                  size={16}
                  color={clockInErrorData.syncStatus === 'saved_on_phone' ? '#D97706' : BRAND.red}
                />
                <Text style={[styles.clockInStatusText, { color: clockInErrorData.syncStatus === 'saved_on_phone' ? colors.text : BRAND.red }]}>
                  {clockInErrorData.syncStatus === 'saved_on_phone' ? 'Will send when you have signal' : 'Not sent to HR yet'}
                </Text>
              </View>
            </View>

            {/* Buttons: "Try again" / "Tell HR instead" only make sense when a selfie is waiting */}
            <View style={{ gap: 10, marginTop: 18 }}>
              {clockInErrorData.photoStatus === 'captured' && (
                <>
                  <TouchableOpacity
                    style={[styles.clockInRetryBtn, { backgroundColor: BRAND.blue }]}
                    onPress={retryVisualOverrideSubmission}
                    disabled={retryingClockIn || submittingReviewTicket}
                  >
                    {retryingClockIn ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="refresh-cw" size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.clockInRetryBtnText}>Try again</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.clockInTicketBtn, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', borderColor: BRAND.blue }]}
                    onPress={submitReviewTicket}
                    disabled={retryingClockIn || submittingReviewTicket}
                  >
                    {submittingReviewTicket ? (
                      <ActivityIndicator size="small" color={BRAND.blue} />
                    ) : (
                      <>
                        <Feather name="send" size={16} color={BRAND.blue} style={{ marginRight: 8 }} />
                        <Text style={[styles.clockInTicketBtnText, { color: BRAND.blue }]}>Tell HR instead</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.clockInDismissBtn}
                onPress={() => setClockInErrorModalVisible(false)}
                disabled={retryingClockIn || submittingReviewTicket}
              >
                <Text style={[styles.clockInDismissBtnText, { color: colors.textMuted }]}>
                  {clockInErrorData.photoStatus === 'captured' ? 'Close' : 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNModal>

        {/* STALE SHIFT RECONCILIATION MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
          isVisible={staleShiftModalVisible}
          onBackdropPress={() => setStaleShiftModalVisible(false)}
          onBackButtonPress={() => setStaleShiftModalVisible(false)}
          style={{ margin: 20, justifyContent: 'center' }}
        >
          <View style={[styles.clockInErrorCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.clockInErrorHeader}>
              <View style={[styles.clockInErrorIconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
                <Feather name="clock" size={28} color="#D97706" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.clockInErrorTitle, { color: colors.text }]}>
                  {stalePunchStart
                    ? `You didn't time out on ${stalePunchStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
                    : "You didn't time out last time"}
                </Text>
              </View>
            </View>

            <Text style={[styles.clockInErrorMessage, { color: colors.text }]}>
              {stalePunchStart ? (
                `You timed in at ${stalePunchStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. What time did you leave? HR will check it.`
              ) : (
                'What time did you leave? HR will check it.'
              )}
            </Text>

            <View style={[styles.clockInErrorStatusBox, { backgroundColor: isDark ? colors.subCard : '#F8FAFC', borderColor: isDark ? colors.cardBorder : '#E2E8F0', padding: 12 }]}>
              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.text, marginBottom: 8 }}>
                I left at:
              </Text>

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {dynamicStalePresets.map(preset => {
                  const isSelected = !isCustomStaleTimeSelected && staleDepartureTime === preset.time;
                  return (
                    <TouchableOpacity
                      key={preset.time}
                      onPress={() => {
                        setIsCustomStaleTimeSelected(false);
                        setStaleDepartureTime(preset.time);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: isSelected ? colors.brandBlue : (isDark ? '#1E293B' : '#FFFFFF'),
                        borderWidth: 1,
                        borderColor: isSelected ? colors.brandBlue : (isDark ? '#334155' : '#CBD5E1'),
                      }}
                    >
                      <Text style={{
                        fontFamily: 'DMSans-Bold',
                        fontSize: 11,
                        color: isSelected ? '#FFFFFF' : colors.text,
                      }}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Time Option */}
                <TouchableOpacity
                  onPress={() => {
                    setIsCustomStaleTimeSelected(true);
                    setShowStaleCustomPicker(true);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: isCustomStaleTimeSelected ? colors.brandBlue : (isDark ? '#1E293B' : '#FFFFFF'),
                    borderWidth: 1,
                    borderColor: isCustomStaleTimeSelected ? colors.brandBlue : (isDark ? '#334155' : '#CBD5E1'),
                  }}
                >
                  <Text style={{
                    fontFamily: 'DMSans-Bold',
                    fontSize: 11,
                    color: isCustomStaleTimeSelected ? '#FFFFFF' : colors.text,
                  }}>
                    {isCustomStaleTimeSelected ? staleDepartureTime : 'Other time'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Dynamic Calculation Live Breakdown */}
              {staleShiftPreview && (
                <View style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: isDark ? colors.cardBorder : '#E2E8F0',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted }}>Left at</Text>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 12, color: colors.text }}>
                      {staleShiftPreview.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                      {staleShiftPreview.endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted }}>Time at work</Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.text }}>
                      {staleShiftPreview.grossHours} h
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted }}>Lunch break</Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: staleShiftPreview.mealDeduction > 0 ? '#F59E0B' : colors.textMuted }}>
                      {staleShiftPreview.mealDeduction > 0 ? '−1 h' : 'none'}
                    </Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#CBD5E1', marginVertical: 4 }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 12, color: colors.text }}>Hours counted</Text>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#10B981' }}>
                      {staleShiftPreview.netHours} h
                    </Text>
                  </View>

                  {staleShiftPreview.isExceedinglyLong && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                      <Feather name="alert-triangle" size={13} color="#F59E0B" />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: '#F59E0B', flex: 1 }}>
                        That's over 16 hours. HR will look at this one closely.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Native DateTimePicker for Custom Departure */}
            {showStaleCustomPicker && (
              <DateTimePicker
                value={staleCustomPickerDate}
                mode="time"
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowStaleCustomPicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setStaleCustomPickerDate(selectedDate);
                    const hh = String(selectedDate.getHours()).padStart(2, '0');
                    const mm = String(selectedDate.getMinutes()).padStart(2, '0');
                    setStaleDepartureTime(`${hh}:${mm}`);
                    setIsCustomStaleTimeSelected(true);
                  }
                }}
              />
            )}

            <View style={{ gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[
                  styles.clockInRetryBtn,
                  {
                    backgroundColor: staleShiftPreview?.isValid ? colors.brandBlue : '#94A3B8',
                    opacity: staleShiftPreview?.isValid ? 1 : 0.6
                  }
                ]}
                onPress={() => handleResolveStaleShift()}
                disabled={resolvingStaleShift || !staleShiftPreview?.isValid}
              >
                {resolvingStaleShift ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check-circle" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.clockInRetryBtnText}>
                      Save time-out ({staleShiftPreview?.netHours ?? 0} h)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clockInDismissBtn}
                onPress={() => setStaleShiftModalVisible(false)}
                disabled={resolvingStaleShift}
              >
                <Text style={[styles.clockInDismissBtnText, { color: colors.textMuted }]}>Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNModal>


        {/* DTR MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={dtrModalVisible}   onBackdropPress={() => setDtrModalVisible(false)} onBackButtonPress={() => setDtrModalVisible(false)} onSwipeComplete={() => setDtrModalVisible(false)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>My DTR</Text>
                <TouchableOpacity onPress={() => setDtrModalVisible(false)}><Feather name="x" size={24} color={colors.textMuted} /></TouchableOpacity>
              </View>
              {dtrLoading ? (
                <ActivityIndicator size="large" color={colors.brandBlue} style={{ marginTop: 40 }} />
              ) : (
                <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
                  {dtrLogs.map((log, idx) => (
                    <View key={idx} style={[styles.dtrRow, { borderBottomColor: isDark ? colors.border : '#F1F5F9' }]}>
                      <View>
                        <Text style={[styles.dtrDate, { color: colors.text }]}>{new Date(log.app_time_in).toLocaleDateString()}</Text>
                        <Text style={[styles.dtrTime, { color: colors.textMuted }]}>{new Date(log.app_time_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: shiftBadge(log.status, isDark).bg }]}>
                        <Text style={[styles.statusText, { color: shiftBadge(log.status, isDark).color }]}>{shiftBadge(log.status, isDark).label}</Text>
                      </View>
                    </View>
                  ))}
                  {dtrLogs.length === 0 && <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>No logs found.</Text>}
                </ScrollView>
              )}
            </View>
          </View>
        </RNModal>

        {/* POLICIES & HANDBOOKS MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
          isVisible={formsModalVisible}
          onBackdropPress={() => setFormsModalVisible(false)}
          onBackButtonPress={() => setFormsModalVisible(false)}
          onSwipeComplete={() => setFormsModalVisible(false)}
          swipeDirection={undefined}
          propagateSwipe={true}
          swipeThreshold={50}
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '75%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: activeFontBold }]}>
                    Policies & Handbooks
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    TechnoCycle Administrative & Safety Compliance
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setFormsModalVisible(false)}>
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {policyLoading && policies.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={BRAND.blue} />
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.textMuted, marginTop: 12 }}>
                    Loading company documents...
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ marginTop: 14 }} showsVerticalScrollIndicator={false}>
                  {policies.map((p) => {
                    const isAck = policyAcks[p.id]?.version === p.version;
                    const getIconAndBg = (cat: string) => {
                      switch (cat) {
                        case 'legal':
                          return { icon: 'file-text' as const, color: '#3B82F6', bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' };
                        case 'field_ops':
                          return { icon: 'shield' as const, color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' };
                        case 'hr_attendance':
                          return { icon: 'clock' as const, color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' };
                        case 'inventory':
                          return { icon: 'tool' as const, color: '#06B6D4', bg: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF' };
                        case 'executive':
                          return { icon: 'award' as const, color: '#8B5CF6', bg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF' };
                        default:
                          return { icon: 'file' as const, color: '#64748B', bg: isDark ? 'rgba(100, 116, 139, 0.15)' : '#F8FAFC' };
                      }
                    };
                    const meta = getIconAndBg(p.category);

                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.profileMenuItem,
                          {
                            borderBottomColor: isDark ? colors.border : '#F1F5F9',
                            paddingVertical: 14,
                          },
                        ]}
                        onPress={() => {
                          setSelectedPolicyForReader(p);
                          setPolicyReaderModalVisible(true);
                        }}
                      >
                        <View style={[styles.profileMenuIcon, { backgroundColor: meta.bg }]}>
                          <Feather name={meta.icon} size={20} color={meta.color} />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={[styles.profileMenuText, { color: colors.text, fontFamily: activeFontBold, flex: 1 }]} numberOfLines={1}>
                              {p.title}
                            </Text>
                            <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }}>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: colors.textMuted }}>{p.version}</Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <View
                              style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                                backgroundColor: isAck
                                  ? isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5'
                                  : isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                              }}
                            >
                              <Text
                                style={{
                                  fontFamily: 'DMSans-Bold',
                                  fontSize: 10,
                                  color: isAck ? BRAND.green : '#D97706',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {isAck ? '✓ Acknowledged' : '• Signature Required'}
                              </Text>
                            </View>

                            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 11, color: colors.textSubtle }}>
                              Effective {p.effective_date}
                            </Text>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={20} color={colors.textSubtle} />
                      </TouchableOpacity>
                    );
                  })}
                  {policies.length === 0 && !policyLoading && (
                    <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40, fontFamily: 'DMSans-Regular' }}>
                      No company policies published yet.
                    </Text>
                  )}
                  <View style={{ height: 40 }} />
                </ScrollView>
              )}
            </View>
          </View>
        </RNModal>

        {/* POLICY READER MODAL */}
        <PolicyReaderModal
          visible={policyReaderModalVisible}
          policy={selectedPolicyForReader}
          isAcknowledged={!!(selectedPolicyForReader && policyAcks[selectedPolicyForReader.id]?.version === selectedPolicyForReader.version)}
          acknowledgedAt={selectedPolicyForReader ? policyAcks[selectedPolicyForReader.id]?.acknowledged_at : null}
          onClose={() => setPolicyReaderModalVisible(false)}
          onAcknowledge={handleAcknowledgePolicy}
        />

        {/* HYBRID POST-PUNCH & MODULE CLICKWRAP ENFORCEMENT MODAL */}
        <PolicyEnforcementModal
          visible={policyEnforcementVisible}
          unacknowledgedPolicies={unacknowledgedPolicies}
          reason={policyEnforcementReason}
          onReview={(policy) => {
            setPolicyEnforcementVisible(false);
            setSelectedPolicyForReader(policy);
            setTimeout(() => setPolicyReaderModalVisible(true), 250);
          }}
          onDismiss={() => setPolicyEnforcementVisible(false)}
        />

        {/* UNIFIED CANONICAL PREFERENCES MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating 
          isVisible={preferencesModalVisible}   
          onBackdropPress={() => setPreferencesModalVisible(false)} 
          onBackButtonPress={() => setPreferencesModalVisible(false)} 
          onSwipeComplete={() => setPreferencesModalVisible(false)} 
          swipeDirection={undefined} 
          propagateSwipe={true} 
          swipeThreshold={50} 
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder, paddingBottom: 40 }]}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={[styles.modalTitle, { fontFamily: activeFontBold, color: colors.text }]}>{t('preferences')}</Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    Customize interface & language
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPreferencesModalVisible(false)} style={{ padding: 4 }}>
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 20 }}>
                {/* LANGUAGE SECTION */}
                <Text style={[{ fontSize: 12, color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }, { fontFamily: activeFontBold }]}>
                  {t('language')}
                </Text>
                
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                  {[
                    { code: 'en' as const, label: 'English', tag: 'EN', font: 'DMSans-Bold' },
                    { code: 'tl' as const, label: 'Filipino', tag: 'FIL', font: 'DMSans-Bold' },
                  ].map((item) => {
                    const isSelected = language === item.code;
                    return (
                      <TouchableOpacity 
                        key={item.code}
                        style={{ 
                          flex: 1, 
                          paddingVertical: 14, 
                          borderRadius: 14, 
                          borderWidth: 1.5, 
                          borderColor: isSelected ? colors.brandBlue : colors.cardBorder, 
                          backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF') : colors.subCard, 
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: isSelected ? colors.brandBlue : 'transparent',
                          shadowOpacity: isSelected ? 0.2 : 0,
                          shadowRadius: 6,
                          elevation: isSelected ? 3 : 0
                        }}
                        onPress={() => setLanguage(item.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: item.font, fontSize: 14, color: isSelected ? colors.brandBlue : colors.text }}>
                          {item.tag}
                        </Text>
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: isSelected ? colors.brandBlue : colors.textMuted, marginTop: 2 }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* APPEARANCE SECTION */}
                <Text style={[{ fontSize: 12, color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }, { fontFamily: activeFontBold }]}>
                  {t('appearance')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                  {[
                    { mode: 'light' as const, label: t('theme_light'), icon: 'sun' },
                    { mode: 'dark' as const, label: t('theme_dark'), icon: 'moon' },
                    { mode: 'system' as const, label: t('theme_system'), icon: 'smartphone' },
                  ].map((item) => {
                    const isSelected = themeMode === item.mode;
                    return (
                      <TouchableOpacity
                        key={item.mode}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isSelected ? colors.brandBlue : colors.cardBorder,
                          backgroundColor: isSelected ? (isDark ? 'rgba(59, 130, 246, 0.18)' : '#EFF6FF') : colors.subCard,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: isSelected ? colors.brandBlue : 'transparent',
                          shadowOpacity: isSelected ? 0.2 : 0,
                          shadowRadius: 6,
                          elevation: isSelected ? 3 : 0
                        }}
                        onPress={() => setThemeMode(item.mode)}
                        activeOpacity={0.7}
                      >
                        <Feather 
                          name={item.icon as any} 
                          size={20} 
                          color={isSelected ? colors.brandBlue : colors.textMuted} 
                        />
                        <Text style={{ 
                          fontFamily: activeFontBold, 
                          fontSize: 13, 
                          color: isSelected ? colors.brandBlue : colors.text, 
                          marginTop: 6 
                        }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* APP VERSION & STATUS */}
                <View style={{ 
                  backgroundColor: colors.subCard, 
                  borderRadius: 14, 
                  padding: 14, 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                      <Feather name="shield" size={16} color={colors.brandBlue} />
                    </View>
                    <View>
                      <Text style={{ fontFamily: activeFontBold, fontSize: 13, color: colors.text }}>TechnoCycle Mobile</Text>
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textMuted }}>Version 0.5.0</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                    <Text style={{ fontFamily: activeFontBold, fontSize: 11, color: BRAND.green }}>Active</Text>
                  </View>
                </View>
                
              </View>
            </View>
          </View>
        </RNModal>

        {/* LOGOUT CONFIRMATION MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={logoutModalVisible}   onBackdropPress={() => setLogoutModalVisible(false)} onBackButtonPress={() => setLogoutModalVisible(false)} onSwipeComplete={() => setLogoutModalVisible(false)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.verificationOverlay}>
            <View style={[styles.verificationCard, { padding: 32, alignItems: 'center', backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
              <View style={[styles.gridIconCircle, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', width: 64, height: 64, borderRadius: 32, marginBottom: 16 }]}>
                <Feather name="log-out" size={32} color="#EF4444" />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8, color: colors.text }]}>Log Out</Text>
              <Text style={[styles.fallbackSub, { textAlign: 'center', color: colors.textMuted }]}>Are you sure you want to log out of your account?</Text>
              
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, width: '100%' }}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.subCard, alignItems: 'center' }} onPress={() => setLogoutModalVisible(false)}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }} onPress={handleLogout}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#FFFFFF' }}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>
        {/* NOTIFICATION DRAWER */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={notifVisible}   onBackdropPress={() => setNotifVisible(false)} onBackButtonPress={() => setNotifVisible(false)} onSwipeComplete={() => setNotifVisible(false)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Notifications</Text>
                <TouchableOpacity onPress={() => setNotifVisible(false)}>
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
                <TouchableOpacity onPress={markAllNotificationsRead}>
                  <Text style={[styles.notifMarkRead, { color: colors.brandBlue }]}>Mark all read</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
                ListEmptyComponent={() => (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Feather name="bell-off" size={44} color={isDark ? '#334155' : '#CBD5E1'} style={{ marginBottom: 12 }} />
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 15, color: colors.textSubtle, textAlign: 'center' }}>
                      No notifications at the moment.
                    </Text>
                  </View>
                )}
                renderItem={({ item: notif }) => {
                  let icon = 'bell';
                  let color = '#64748B';
                  let bgColor = isDark ? colors.subCard : '#F1F5F9';
                  if (notif.type === 'dispatch') { icon = 'navigation'; color = '#3B82F6'; bgColor = isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE'; }
                  if (notif.type === 'hr') { icon = 'check-circle'; color = '#10B981'; bgColor = isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5'; }
                  if (notif.type === 'tool') { icon = 'tool'; color = '#F59E0B'; bgColor = isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7'; }
                  if (notif.type === 'admin') { icon = 'file-text'; color = colors.brandBlue; bgColor = isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE'; }
                  if (notif.type === 'help') { icon = 'alert-circle'; color = '#EF4444'; bgColor = isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2'; }

                  const pillBg = isDark ? (notif.categoryBgDark || 'rgba(59, 130, 246, 0.2)') : (notif.categoryBgLight || '#EFF6FF');
                  const pillColor = notif.categoryColor || colors.brandBlue;

                  return (
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      style={[
                        styles.notifModernCard,
                        !notif.read && styles.notifModernCardUnread,
                        !notif.read && { borderLeftColor: pillColor }
                      ]}
                      onPress={() => {
                        markNotificationRead(notif.id);
                        if (notif.ticketId || notif.actionType === 'chat') {
                          if (notif.ticketId) setSelectedChatTicketId(notif.ticketId);
                          setNotifVisible(false);
                          setSupportModalVisible(true);
                        } else if (notif.actionType === 'dispatch') {
                          setNotifVisible(false);
                          openJobDetails();
                        } else if (notif.actionType === 'tool') {
                          setNotifVisible(false);
                          router.push('/tools' as Href);
                        } else {
                          setSelectedNotif(notif);
                        }
                      }}
                    >
                      {/* Top Header Row: Category Pill + Status Tag + Timestamp */}
                      <View style={styles.notifHeaderRow}>
                        <View style={styles.notifBadgeRow}>
                          <View style={[styles.notifPill, { backgroundColor: pillBg, borderColor: pillColor + '40' }]}>
                            <Text style={[styles.notifPillText, { color: pillColor }]}>
                              {(notif.category || 'NOTICE').toUpperCase()}
                            </Text>
                          </View>
                          {!!notif.statusTag && (
                            <View style={[styles.notifStatusPill, { 
                              backgroundColor: notif.statusTag === 'Approved' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5') :
                                              notif.statusTag === 'Refused' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') :
                                              (isDark ? colors.subCard : '#F1F5F9')
                            }]}>
                              <Text style={[styles.notifStatusText, { 
                                color: notif.statusTag === 'Approved' ? '#10B981' :
                                       notif.statusTag === 'Refused' ? '#EF4444' :
                                       colors.textSubtle
                              }]}>
                                {notif.statusTag}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.notifTimeRow}>
                          <Text style={styles.notifTimeText}>{notif.time}</Text>
                          {!notif.read && <View style={[styles.notifDot, { backgroundColor: pillColor }]} />}
                        </View>
                      </View>

                      {/* Card Content */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
                        <View style={[styles.notifIconCircle, { backgroundColor: bgColor, width: 36, height: 36, borderRadius: 18, marginRight: 12, marginTop: 2 }]}>
                          <Feather name={icon as any} size={18} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.notifItemTitle, { color: colors.text, fontSize: 14 }]} numberOfLines={1}>
                            {notif.title}
                          </Text>
                          <Text style={[styles.notifItemDesc, { color: colors.textMuted, fontSize: 13, marginBottom: 0 }]} numberOfLines={2}>
                            {notif.desc}
                          </Text>
                        </View>
                      </View>

                      {/* Action / Reviewer Row */}
                      <View style={styles.notifActionRow}>
                        {notif.reviewer ? (
                          <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textSubtle }}>
                            Reviewed by {notif.reviewer}
                          </Text>
                        ) : (
                          <View />
                        )}
                        <View style={styles.notifActionChip}>
                          <Text style={[styles.notifActionChipText, { color: pillColor }]}>
                            {notif.actionLabel || 'Details'}
                          </Text>
                          <Feather name="arrow-right" size={11} color={pillColor} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={() => (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textSubtle, textAlign: 'center' }}>
                      Showing latest notifications. Older alerts are automatically archived in their respective modules.
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </RNModal>

        {/* NOTIFICATION DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating 
          isVisible={!!selectedNotif} 
          onBackdropPress={() => setSelectedNotif(null)} 
          onBackButtonPress={() => setSelectedNotif(null)} 
          onSwipeComplete={() => setSelectedNotif(null)} 
          swipeDirection={undefined} 
          propagateSwipe={true} 
          swipeThreshold={50} 
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 20 }}>
            {selectedNotif && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <TouchableOpacity onPress={() => setSelectedNotif(null)} style={{ padding: 8, marginLeft: -8 }}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginLeft: 8 }}>Notification Details</Text>
                </View>
                
                <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                  {/* Category & Status Badges */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.notifPill, { 
                        backgroundColor: isDark ? (selectedNotif.categoryBgDark || 'rgba(59, 130, 246, 0.2)') : (selectedNotif.categoryBgLight || '#EFF6FF'),
                        borderColor: (selectedNotif.categoryColor || colors.brandBlue) + '40'
                      }]}>
                        <Text style={[styles.notifPillText, { color: selectedNotif.categoryColor || colors.brandBlue }]}>
                          {(selectedNotif.category || 'NOTICE').toUpperCase()}
                        </Text>
                      </View>
                      {!!selectedNotif.statusTag && (
                        <View style={[styles.notifStatusPill, { 
                          backgroundColor: selectedNotif.statusTag === 'Approved' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5') :
                                          selectedNotif.statusTag === 'Refused' ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2') :
                                          (isDark ? colors.subCard : '#F1F5F9')
                        }]}>
                          <Text style={[styles.notifStatusText, { 
                            color: selectedNotif.statusTag === 'Approved' ? '#10B981' :
                                   selectedNotif.statusTag === 'Refused' ? '#EF4444' :
                                   colors.textSubtle
                          }]}>
                            {selectedNotif.statusTag}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textSubtle }}>
                      {selectedNotif.time}
                    </Text>
                  </View>

                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginBottom: 8 }}>
                    {selectedNotif.title}
                  </Text>

                  {selectedNotif.reviewer && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 }}>
                      <Feather name="user-check" size={14} color={colors.textSubtle} />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textSubtle }}>
                        Reviewed by: <Text style={{ color: colors.text, fontFamily: 'DMSans-Bold' }}>{selectedNotif.reviewer}</Text>
                      </Text>
                    </View>
                  )}
                  
                  <View style={[styles.detailDivider, { backgroundColor: isDark ? colors.border : '#E2E8F0', marginVertical: 12 }]} />
                  
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.textMuted, lineHeight: 24 }}>
                      {selectedNotif.desc}
                    </Text>
                  </ScrollView>

                  {/* Direct Deep-Linking Action Button */}
                  {selectedNotif.ticketId ? (
                    <TouchableOpacity 
                      style={[styles.submitBtn, { backgroundColor: colors.brandBlue, marginTop: 20 }]} 
                      onPress={() => {
                        const tId = selectedNotif.ticketId;
                        setSelectedNotif(null);
                        setSelectedChatTicketId(tId);
                        setNotifVisible(false);
                        setSupportModalVisible(true);
                      }}
                    >
                      <Feather name="message-square" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.submitBtnText}>Open in HR Chat</Text>
                    </TouchableOpacity>
                  ) : selectedNotif.actionType === 'dispatch' ? (
                    <TouchableOpacity 
                      style={[styles.submitBtn, { backgroundColor: colors.brandBlue, marginTop: 20 }]} 
                      onPress={() => {
                        setSelectedNotif(null);
                        setNotifVisible(false);
                        openJobDetails();
                      }}
                    >
                      <Feather name="navigation" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.submitBtnText}>View Dispatch</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </RNModal>

        {/* SUPPORT MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating 
          isVisible={supportModalVisible}   
          onBackdropPress={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); setAiInitialQuery(''); setAiInitialTicketData(null); }} 
          onBackButtonPress={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); setAiInitialQuery(''); setAiInitialTicketData(null); }} 
          onSwipeComplete={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); setAiInitialQuery(''); setAiInitialTicketData(null); }} 
          swipeDirection={undefined} 
          propagateSwipe={true} 
          swipeThreshold={50} 
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <SupportChatUI 
            onClose={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); setAiInitialQuery(''); setAiInitialTicketData(null); }} 
            initialQuery={aiInitialQuery} 
            ticketId={selectedChatTicketId || undefined} 
            initialTicketData={aiInitialTicketData}
          />
        </RNModal>

        {/* SUPPORT TICKET DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={!!selectedTicket}   onBackdropPress={() => setSelectedTicket(null)} onBackButtonPress={() => setSelectedTicket(null)} onSwipeComplete={() => setSelectedTicket(null)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 24 }}>
            {/* --- DETAILED VIEW: TICKET --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setSelectedTicket(null)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginLeft: 8 }}>Ticket Details</Text>
            </View>
            
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.cardBorder, flex: 1, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, marginBottom: 4 }}>
                    {selectedTicket?.title}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.textSubtle }}>
                    {selectedTicket?.category} • {selectedTicket?.created_at ? formatRelativeTime(selectedTicket.created_at) : ''}
                  </Text>
                </View>
                <View style={[styles.ticketBadge, selectedTicket?.status === 'open' ? styles.badgeOpen : styles.badgeResolved]}>
                  <Text style={[styles.ticketBadgeText, selectedTicket?.status === 'open' ? styles.badgeTextOpen : styles.badgeTextResolved]}>
                    {selectedTicket?.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={[styles.detailDivider, { backgroundColor: isDark ? colors.border : '#E2E8F0', marginVertical: 12 }]} />
              
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: colors.text, marginBottom: 8 }}>DESCRIPTION</Text>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.textMuted, lineHeight: 22 }}>
                  {selectedTicket?.description}
                </Text>
              </ScrollView>
            </View>
          </View>
        </RNModal>

        {/* SCHEDULES MODAL (LIST VIEW) */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={schedulesModalVisible}   onBackdropPress={() => setSchedulesModalVisible(false)} onBackButtonPress={() => setSchedulesModalVisible(false)} onSwipeComplete={() => setSchedulesModalVisible(false)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '85%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>My Schedules</Text>
                <TouchableOpacity onPress={() => setSchedulesModalVisible(false)}>
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {schedulesLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.brandBlue} />
                </View>
              ) : (
                <FlatList
                  data={schedulesList}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                  ListEmptyComponent={() => (
                    <View style={{ padding: 32, alignItems: 'center' }}>
                      <Feather name="calendar" size={48} color={isDark ? '#334155' : '#CBD5E1'} style={{ marginBottom: 16 }} />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: colors.textSubtle, textAlign: 'center' }}>
                        You have no upcoming schedules.
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.updateCard}
                      activeOpacity={0.7}
                      onPress={() => setSelectedSchedule(item)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.updateTitle}>
                              {item.client_name}
                            </Text>
                            {item.is_vip_hook && (
                              <View style={{ backgroundColor: BRAND.yellow, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 8 }}>
                                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 9, color: '#fff' }}>VIP</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.updateSub, { marginTop: 4 }]} numberOfLines={1}>
                            {item.location}
                          </Text>
                          
                          <View style={{ flexDirection: 'row', marginTop: 12 }}>
                            <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                              <Feather name="clock" size={12} color={colors.brandBlue} style={{ marginRight: 4 }} />
                              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 11, color: colors.brandBlue }}>
                                {item.start_time ? new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: isDark ? colors.subCard : '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textMuted }}>
                                {item.start_time ? new Date(item.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '---'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </RNModal>

        {/* SCHEDULES DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={!!selectedSchedule}   onBackdropPress={() => setSelectedSchedule(null)} onBackButtonPress={() => setSelectedSchedule(null)} onSwipeComplete={() => setSelectedSchedule(null)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 20 }}>
            {/* --- DETAILED VIEW: SCHEDULE --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <TouchableOpacity onPress={() => setSelectedSchedule(null)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginLeft: 8 }}>Schedule Details</Text>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.cardBorder }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, marginBottom: 4 }}>
                      {selectedSchedule?.client_name}
                    </Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 14, color: colors.textMuted }}>
                      {selectedSchedule?.location}
                    </Text>
                  </View>
                  {selectedSchedule?.is_vip_hook && (
                    <View style={{ backgroundColor: BRAND.yellow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 10, color: '#fff' }}>VIP</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.detailDivider} />
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Start Time</Text>
                  <Text style={styles.detailLineValue}>
                    {selectedSchedule?.start_time ? new Date(selectedSchedule.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                  </Text>
                </View>
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>End Time</Text>
                  <Text style={styles.detailLineValue}>
                    {selectedSchedule?.end_time ? new Date(selectedSchedule.end_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                  </Text>
                </View>
                
                <View style={styles.detailDivider} />
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Attendance Mode</Text>
                  <Text style={styles.detailLineValue}>
                    {selectedSchedule?.attendance_mode ? selectedSchedule.attendance_mode.toUpperCase() : 'STANDARD'}
                  </Text>
                </View>

                {selectedSchedule?.attendance_tracking_mode && (
                  <View style={styles.detailLine}>
                    <Text style={styles.detailLineLabel}>Tracking</Text>
                    <Text style={styles.detailLineValue}>
                      {selectedSchedule.attendance_tracking_mode.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* ASSIGNED FIELD CREW SECTION */}
                <View style={{ marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? colors.border : '#F1F5F9' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Feather name="users" size={16} color={colors.brandBlue} style={{ marginRight: 6 }} />
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: colors.text }}>
                        Team
                      </Text>
                    </View>
                    <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 11, color: colors.brandBlue }}>
                        {activeCrew.length} {activeCrew.length === 1 ? 'person' : 'people'}
                      </Text>
                    </View>
                  </View>

                  {loadingCrew ? (
                    <ActivityIndicator size="small" color={colors.brandBlue} style={{ marginVertical: 12 }} />
                  ) : activeCrew.length === 0 ? (
                    <View style={{ padding: 12, borderRadius: 12, backgroundColor: isDark ? colors.subCard : '#F8FAFC', borderWidth: 1, borderColor: colors.cardBorder }}>
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>
                        Just you on this job
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {activeCrew.map((member) => (
                        <View
                          key={member.id + member.type}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: isDark ? colors.subCard : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor:
                                  member.type === 'lead'
                                    ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7')
                                    : member.type === 'helper'
                                    ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF')
                                    : (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5'),
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                              }}
                            >
                              <Feather
                                name={member.type === 'lead' ? 'award' : member.type === 'helper' ? 'user-check' : 'briefcase'}
                                size={16}
                                color={member.type === 'lead' ? BRAND.yellow : member.type === 'helper' ? BRAND.blue : BRAND.green}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 13, color: colors.text }} numberOfLines={1}>
                                  {member.name}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor:
                                      member.type === 'lead'
                                        ? BRAND.yellow
                                        : member.type === 'helper'
                                        ? BRAND.blue
                                        : BRAND.green,
                                    paddingHorizontal: 6,
                                    paddingVertical: 1.5,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 9, color: '#fff' }}>
                                    {member.role}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                                {member.phone || 'No phone registered'}
                              </Text>
                            </View>
                          </View>

                          {member.phone && member.id !== profile?.id ? (
                            <TouchableOpacity
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: BRAND.green + '40',
                                marginLeft: 8,
                              }}
                              onPress={() => Linking.openURL(`tel:${member.phone?.replace(/[^0-9+]/g, '')}`)}
                              activeOpacity={0.7}
                            >
                              <Feather name="phone" size={16} color={BRAND.green} />
                            </TouchableOpacity>
                          ) : member.id === profile?.id ? (
                            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: isDark ? colors.subCard : '#F1F5F9', marginLeft: 8 }}>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textMuted }}>You</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                
              </View>
              
              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: colors.brandBlue, marginTop: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]} 
                onPress={() => {
                  if (selectedSchedule?.geofence_lat || selectedSchedule?.location) {
                    openDirections(selectedSchedule.geofence_lat, selectedSchedule.geofence_lon, selectedSchedule.location);
                  } else {
                    safeAlert('No address', "This job has no address yet. Ask your coordinator.");
                  }
                }}
              >
                <Feather name="navigation" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Navigate to site</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </RNModal>

        {/* TIMESHEETS MODAL */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating isVisible={timesheetModalVisible} onBackdropPress={() => { if(selectedTimeLog) setSelectedTimeLog(null); else setTimesheetModalVisible(false); }} onBackButtonPress={() => { if(selectedTimeLog) setSelectedTimeLog(null); else setTimesheetModalVisible(false); }} onSwipeComplete={() => { if(selectedTimeLog) setSelectedTimeLog(null); else setTimesheetModalVisible(false); }} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          {selectedTimeLog ? (
            <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 24 }}>
              {/* --- DETAILED VIEW: TIMESHEET --- */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={() => setSelectedTimeLog(null)} style={{ padding: 8, marginLeft: -8 }}>
                  <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginLeft: 8 }}>Time Log Details</Text>
              </View>
              
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.cardBorder }}>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, marginBottom: 4 }}>
                  {new Date(selectedTimeLog.created_at || selectedTimeLog.app_time_in).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: shiftBadge(selectedTimeLog.status, isDark).bg }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: shiftBadge(selectedTimeLog.status, isDark).color }}>
                      {shiftBadge(selectedTimeLog.status, isDark).label}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: colors.brandBlue, marginLeft: 12 }}>
                    {selectedTimeLog.total_hours ? `${selectedTimeLog.total_hours} hrs` : '---'}
                  </Text>
                </View>
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Time In</Text>
                  <Text style={[styles.detailLineValue, { color: colors.text }]}>
                    {selectedTimeLog.app_time_in ? new Date(selectedTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                  </Text>
                </View>
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Time Out</Text>
                  <Text style={[styles.detailLineValue, { color: colors.text }]}>
                    {selectedTimeLog.app_time_out ? new Date(selectedTimeLog.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                  </Text>
                </View>
                
                <View style={styles.detailDivider} />
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Geofence Status</Text>
                  <Text style={[styles.detailLineValue, { color: selectedTimeLog.geofence_status === 'passed' || selectedTimeLog.geofence_status === 'inside' ? BRAND.green : BRAND.yellow }]}>
                    {selectedTimeLog.geofence_status ? selectedTimeLog.geofence_status.toUpperCase() : 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Photo Status</Text>
                  <Text style={[styles.detailLineValue, { color: colors.text }]}>
                    {selectedTimeLog.photo_status ? selectedTimeLog.photo_status.replace('_', ' ').toUpperCase() : 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.detailLine}>
                  <Text style={styles.detailLineLabel}>Manual Entry</Text>
                  <Text style={[styles.detailLineValue, { color: colors.text }]}>
                    {selectedTimeLog.is_manual_entry ? 'YES' : 'NO'}
                  </Text>
                </View>
                
                {selectedTimeLog.photo_url && (
                  <View style={{ marginTop: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>Verification Photo</Text>
                    <Image source={{ uri: selectedTimeLog.photo_url }} style={{ width: 120, height: 160, borderRadius: 12, backgroundColor: isDark ? colors.subCard : '#F1F5F9' }} resizeMode="cover" />
                  </View>
                )}
                
              </View>
              
              <TouchableOpacity 
                style={[
                  styles.submitBtn, 
                  { 
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2', 
                    borderWidth: 1, 
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5', 
                    marginTop: 24, 
                    flexDirection: 'row', 
                    justifyContent: 'center' 
                  }
                ]} 
                onPress={() => handleDisputeTimeLog(selectedTimeLog)}
              >
                <Feather name="alert-circle" size={20} color={BRAND.red} style={{ marginRight: 8 }} />
                <Text style={[styles.submitBtnText, { color: BRAND.red }]}>Dispute This Entry</Text>
              </TouchableOpacity>
              
            </View>
          ) : (
            <View style={styles.profileOverlay}>
              <View style={[styles.profileSheet, { height: '85%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>My Timesheets</Text>
                  <TouchableOpacity onPress={() => setTimesheetModalVisible(false)}>
                    <Feather name="x" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.submitBtn, 
                    { 
                      backgroundColor: isDark ? colors.subCard : '#FFFFFF', 
                      borderWidth: 1, 
                      borderColor: isDark ? colors.cardBorder : '#E2E8F0', 
                      marginBottom: 16, 
                      flexDirection: 'row', 
                      justifyContent: 'center' 
                    }
                  ]} 
                  onPress={() => handleDisputeTimeLog(null)}
                >
                  <Feather name="alert-circle" size={20} color={BRAND.red} style={{ marginRight: 8 }} />
                  <Text style={[styles.submitBtnText, { color: BRAND.red }]}>Dispute Time Log</Text>
                </TouchableOpacity>

                {timesheetLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={BRAND.blue} />
                  </View>
                ) : (
                  <FlatList
                    data={timeLogs}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                    ListEmptyComponent={() => (
                      <View style={{ padding: 32, alignItems: 'center' }}>
                        <Feather name="clock" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: colors.textMuted, textAlign: 'center' }}>
                          No time logs found.
                        </Text>
                      </View>
                    )}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={[styles.updateCard, { borderBottomColor: colors.cardBorder }]}
                        activeOpacity={0.7}
                        onPress={() => setSelectedTimeLog(item)}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.updateTitle, { color: colors.text }]}>
                              {new Date(item.created_at || item.app_time_in).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
                            </Text>
                            <Text style={[styles.updateSub, { marginTop: 4, color: colors.textMuted }]}>
                              {item.app_time_in ? new Date(item.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                              {' - '}
                              {item.app_time_out ? new Date(item.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                            </Text>
                            
                            <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'center' }}>
                              <View style={{ backgroundColor: isDark ? colors.subCard : '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 11, color: colors.brandBlue }}>
                                  {item.total_hours ? `${item.total_hours} hrs` : '---'}
                                </Text>
                              </View>
                              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: shiftBadge(item.status, isDark).bg }}>
                                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 10, color: shiftBadge(item.status, isDark).color }}>
                                  {shiftBadge(item.status, isDark).label}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Feather name="chevron-right" size={20} color={colors.textMuted} />
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          )}
        </RNModal>

        {/* CHUNK 46: SHIFT DISPUTE BOTTOM SHEET PICKER */}
        <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
          isVisible={shiftDisputeModalVisible}
          onBackdropPress={() => setShiftDisputeModalVisible(false)}
          onBackButtonPress={() => setShiftDisputeModalVisible(false)}
          onSwipeComplete={() => setShiftDisputeModalVisible(false)}
          swipeDirection={undefined}
          propagateSwipe={true}
          swipeThreshold={50}
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { maxHeight: '80%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              {/* Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                  <View style={[styles.clockInErrorIconBox, { width: 38, height: 38, borderRadius: 10, backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                    <Feather name="alert-triangle" size={20} color={BRAND.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.text, fontSize: 18 }]}>Select Shift to Dispute</Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted }}>Choose a shift to pre-fill your dispute ticket</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShiftDisputeModalVisible(false)}>
                  <Feather name="x" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Missing Shift Quick Action */}
              <TouchableOpacity
                style={[
                  styles.disputeMissingBtn,
                  { 
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
                  }
                ]}
                onPress={handleDisputeMissingShift}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Feather name="help-circle" size={20} color={BRAND.blue} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.disputeMissingBtnText, { color: BRAND.blue }]}>Shift Missing from List?</Text>
                    <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted }}>Dispute an unrecorded workday or cloud sync delay</Text>
                  </View>
                </View>
                <Feather name="arrow-right" size={16} color={BRAND.blue} />
              </TouchableOpacity>

              {/* Shifts List */}
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 12, color: colors.textMuted, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Recorded Shifts ({timeLogs?.length || 0})
              </Text>

              <FlatList
                data={timeLogs}
                keyExtractor={(item) => `dispute-${item.id}`}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
                ListEmptyComponent={() => (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                      No shifts recorded yet. Use the missing shift option above to report your attendance.
                    </Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.disputeShiftCard,
                      {
                        backgroundColor: isDark ? colors.subCard : '#F8FAFC',
                        borderColor: colors.cardBorder,
                      }
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectShiftToDispute(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.disputeShiftDate, { color: colors.text }]}>
                        {new Date(item.created_at || item.app_time_in).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <Text style={[styles.disputeShiftTimes, { color: colors.textMuted }]}>
                        {item.app_time_in ? new Date(item.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        {' → '}
                        {item.app_time_out ? new Date(item.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing / Missing'}
                      </Text>

                      <View style={{ flexDirection: 'row', marginTop: 8, gap: 6, alignItems: 'center' }}>
                        <View style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 10, color: colors.brandBlue }}>
                            {item.total_hours ? `${item.total_hours} hrs` : 'Incomplete'}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: shiftBadge(item.status, isDark).bg }}>
                          <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 9, color: shiftBadge(item.status, isDark).color }}>
                            {shiftBadge(item.status, isDark).label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 13, color: BRAND.red }}>Dispute</Text>
                      <Feather name="chevron-right" size={16} color={BRAND.red} />
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </RNModal>



      </SafeAreaView>
    </GlowScreen>
  );
}

const MenuGridItem = ({ icon, label, color, onPress, fontFamily }: { icon: any, label: string, color: string, onPress?: () => void, fontFamily?: string }) => {
  const { isDark, colors } = useAppTheme();
  return (
    <TouchableOpacity style={{ width: '33.33%', alignItems: 'center', marginBottom: 12, marginTop: 4 }} onPress={onPress}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? colors.subCard : '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <Text style={[{ fontFamily: 'DMSans-Medium', fontSize: 13, color: '#fff', textAlign: 'center' }, fontFamily ? { fontFamily } : {}]}>{label}</Text>
    </TouchableOpacity>
  );
};

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  masterContainer: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  headerBtnOutline: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? colors.subCard : 'transparent' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, letterSpacing: -0.5 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.red },
  mainContent: { paddingHorizontal: 24, flex: 1, paddingTop: 8, paddingBottom: 110 },
  clockInCard: { backgroundColor: colors.card, borderRadius: 28, padding: 24, flexDirection: 'row', alignItems: 'center', shadowColor: isDark ? '#000' : BRAND.blue, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 8, marginBottom: 40, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  clockInIconContainer: { width: 64, height: 64, borderRadius: 20, backgroundColor: isDark ? colors.subCard : '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  clockInTextContainer: { flex: 1 },
  clockInTitle: { fontFamily: 'DMSans-Bold', fontSize: 22, color: colors.text, marginBottom: 4 },
  clockInSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted },
  activeShiftCard: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 36,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#BBF7D0',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  activeShiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  activePulseText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: '#10B981',
    letterSpacing: 0.5,
  },
  activeShiftTime: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: colors.textSubtle,
  },
  activeShiftBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeShiftTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    color: colors.text,
  },
  activeShiftElapsed: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
    color: colors.brandBlue,
    marginTop: 2,
  },
  clockOutBtn: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clockOutBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#EF4444',
  },
  completedShiftCard: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 40 },
  bubbleBtn: { alignItems: 'center', gap: 12 },
  bubbleCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10, shadowColor: isDark ? '#000' : undefined },
  bubbleText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: colors.text },
  infoCard: { backgroundColor: colors.card, borderRadius: 24, padding: 24, shadowColor: isDark ? '#000' : '#C0C2C9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 5, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  dispatchWidget: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#DBEAFE', overflow: 'hidden', shadowColor: isDark ? '#000' : '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, marginTop: 12 },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? colors.subCard : '#EFF6FF', padding: 16, borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : '#DBEAFE' },
  dispatchIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#1E293B' : '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dispatchWidgetTitle: { fontFamily: 'DMSans-Bold', fontSize: 13, color: colors.brandBlue, letterSpacing: 1 },
  dispatchWidgetSub: { fontFamily: 'DMSans-Medium', fontSize: 11, color: isDark ? colors.textMuted : '#3B82F6' },
  dispatchBody: { padding: 20 },
  dispatchDestination: { fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginBottom: 8 },
  dispatchClient: { fontFamily: 'DMSans-Medium', fontSize: 14, color: colors.textMuted },
  dispatchAction: { backgroundColor: colors.brandBlue, padding: 16, alignItems: 'center' },
  dispatchActionText: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#FFFFFF' },
  infoTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: colors.text, marginBottom: 6 },
  infoSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  floatingMenuContainer: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  menuPill: { backgroundColor: BRAND.blue, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 32, shadowColor: BRAND.yellow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  menuPillText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: BRAND.yellow },
  menuOverlay: { flex: 1, backgroundColor: isDark ? 'rgba(11, 15, 23, 0.96)' : 'rgba(15, 23, 42, 0.95)' },
  menuContent: { flex: 1 },
  menuHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  menuHeaderText: { fontFamily: 'DMSans-Bold', fontSize: 20, color: '#fff' },
  closeBtnTop: { padding: 8 },
  menuScroll: { paddingHorizontal: 24 },
  categoryTitle: { fontFamily: 'DMSans-Bold', fontSize: 22, color: '#fff', marginTop: 12, marginBottom: 12 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 8 },
  gridItem: { width: '33.33%', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  gridIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? colors.subCard : '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridItemText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#fff', textAlign: 'center' },
  bottomCloseContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  flowerCloseBtn: { alignItems: 'center', justifyContent: 'center' },
  flowerRing1: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(251, 191, 36, 0.15)', justifyContent: 'center', alignItems: 'center' },
  flowerRing2: { width: 76, height: 76, borderRadius: 38, backgroundColor: BRAND.blue, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: BRAND.yellow },
  flowerText: { fontFamily: 'DMSans-Bold', fontSize: 12, color: BRAND.yellow, textAlign: 'center', lineHeight: 16 },
  verificationOverlay: { flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  verificationCard: { backgroundColor: colors.card, borderRadius: 24, width: '100%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  verifyingState: { padding: 48, alignItems: 'center' },
  verifyingText: { fontFamily: 'DMSans-Medium', fontSize: 16, color: colors.textMuted, marginTop: 20 },
  fallbackState: { padding: 24 },
  fallbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fallbackTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text },
  fallbackSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted, marginBottom: 14 },
  mapContainer: { height: 280, borderRadius: 20, overflow: 'hidden', backgroundColor: isDark ? colors.subCard : '#F1F5F9', marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder },
  map: { width: '100%', height: '100%' },
  fallbackBtn: { backgroundColor: colors.brandBlue, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  fallbackBtnText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#fff' },
  profileOverlay: { flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  profileSheet: { backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 48, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#334155' : '#CBD5E1', alignSelf: 'center', marginBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.subCard : '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, marginBottom: 4 },
  profileRole: { fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted, letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.green, marginRight: 6 },
  statusText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: BRAND.green },
  closeProfileBtn: { position: 'absolute', top: 24, right: 24, width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-end' },
  profileMenu: { marginTop: 8 },
  profileMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9' },
  profileMenuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileMenuText: { flex: 1, fontFamily: 'DMSans-Medium', fontSize: 16, color: colors.text },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: 'DMSans-Bold', fontSize: 24, color: colors.text },
  dtrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9' },
  dtrDate: { fontFamily: 'DMSans-Medium', fontSize: 16, color: colors.text, marginBottom: 4 },
  dtrTime: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted },
  notifDrawer: { width: width * 0.85, height: '100%', backgroundColor: colors.card, alignSelf: 'flex-end', shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: Platform.OS === 'web' ? 24 : 64, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9' },
  notifTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text },
  notifMarkRead: { fontFamily: 'DMSans-Medium', fontSize: 14, color: colors.brandBlue },
  notifItem: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9', alignItems: 'flex-start' },
  notifItemUnread: { backgroundColor: isDark ? colors.subCard : '#F8FAFC' },
  notifIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  notifItemTitle: { fontFamily: 'DMSans-Bold', fontSize: 15, color: colors.text, marginBottom: 4 },
  notifItemDesc: { fontFamily: 'DMSans-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 8, lineHeight: 18 },
  notifItemTime: { fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textSubtle },
  notifUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandBlue, marginTop: 6 },
  notifModernCard: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  notifModernCardUnread: {
    borderLeftWidth: 4,
    borderColor: isDark ? colors.cardBorder : '#BFDBFE',
    backgroundColor: isDark ? colors.card : '#F8FAFC',
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notifBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  notifPillText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  notifStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  notifStatusText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  notifTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTimeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: colors.textSubtle,
  },
  notifDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.brandBlue,
  },
  notifActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: isDark ? colors.border : '#F1F5F9',
  },
  notifActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? colors.subCard : '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  notifActionChipText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: colors.brandBlue,
  },
  updateModernCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.25 : 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  updateAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateAuthorName: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: colors.text,
  },
  updatePriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  updatePriorityText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  updateExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  updateExpandText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
    color: colors.brandBlue,
  },
  equipItem: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9', alignItems: 'center' },
  equipImagePlaceholder: { width: 64, height: 64, borderRadius: 12, backgroundColor: isDark ? colors.subCard : '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 16, overflow: 'hidden' },
  equipImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  equipTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: colors.text, marginBottom: 4 },
  equipSub: { fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.textMuted },
  equipStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' },
  statusOverdue: { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2' },
  equipStatusText: { fontFamily: 'DMSans-Bold', fontSize: 10, letterSpacing: 1 },
  textActive: { color: BRAND.green },
  textOverdue: { color: BRAND.red },
  newTicketBtn: { backgroundColor: colors.brandBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginBottom: 16, marginTop: 16 },
  newTicketBtnText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#fff' },
  ticketItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9' },
  ticketTitle: { fontFamily: 'DMSans-Bold', fontSize: 15, color: colors.text, marginBottom: 4 },
  ticketSub: { fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted },
  ticketBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeOpen: { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.2)' : '#FEF3C7' },
  badgeResolved: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' },
  ticketBadgeText: { fontFamily: 'DMSans-Bold', fontSize: 10, letterSpacing: 1 },
  badgeTextOpen: { color: BRAND.yellow },
  badgeTextResolved: { color: BRAND.green },
  inputLabel: { fontFamily: 'DMSans-Bold', fontSize: 14, color: colors.text, marginBottom: 8, marginTop: 16 },
  inputField: { backgroundColor: isDark ? colors.subCard : '#F8FAFC', borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'DMSans-Medium', fontSize: 15, color: colors.text },
  textInput: { backgroundColor: isDark ? colors.subCard : '#F8FAFC', borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'DMSans-Medium', fontSize: 15, color: colors.text },
  updateCard: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9', alignItems: 'flex-start' },
  categoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: isDark ? colors.subCard : '#F1F5F9', borderWidth: 1, borderColor: 'transparent' },
  categoryPillActive: { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF', borderColor: colors.brandBlue },
  categoryPillText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.textMuted },
  categoryPillTextActive: { color: colors.brandBlue, fontFamily: 'DMSans-Bold' },
  submitBtn: { backgroundColor: BRAND.green, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  submitBtnText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#fff' },
  updateItem: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9', alignItems: 'flex-start' },
  updateIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? colors.subCard : '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  updateTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: colors.text, marginBottom: 6 },
  updateSub: { fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  updateContent: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  woItem: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : '#F1F5F9', alignItems: 'center' },
  woTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: colors.text, marginBottom: 4 },
  woDesc: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted, marginBottom: 8 },
  woDate: { fontFamily: 'DMSans-Medium', fontSize: 12, color: BRAND.yellow },
  woActionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  woPending: { backgroundColor: colors.card, borderColor: isDark ? colors.cardBorder : '#E2E8F0' },
  woCompleted: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', borderColor: isDark ? '#065F46' : '#A7F3D0' },
  detailCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailPeriodTitle: { fontFamily: 'DMSans-Bold', fontSize: 10, color: colors.textSubtle, letterSpacing: 1, marginBottom: 4 },
  detailPeriod: { fontFamily: 'DMSans-Bold', fontSize: 14, color: colors.text },
  detailNetBox: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'flex-end' },
  detailNetLabel: { fontFamily: 'DMSans-Medium', fontSize: 10, color: BRAND.green, marginBottom: 2 },
  detailNetValue: { fontFamily: 'DMSans-Bold', fontSize: 16, color: BRAND.green },
  detailDetails: { marginTop: 16 },
  detailDivider: { height: 1, backgroundColor: isDark ? colors.border : '#F1F5F9', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailCol: { flex: 1, paddingRight: 8 },
  detailSectionTitle: { fontFamily: 'DMSans-Bold', fontSize: 12, color: colors.text, marginBottom: 12 },
  detailLineItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detailLineLabel: { fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted },
  detailLineValue: { fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.text },
  detailFooter: { marginTop: 16, alignItems: 'center' },
  detailFooterText: { fontFamily: 'DMSans-Medium', fontSize: 10, color: colors.textSubtle },
  detailSectionCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },

  // Chunk 45: Clock-In Error & Fallback Modal Styles
  clockInErrorCard: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  clockInErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  clockInErrorIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockInErrorTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 17,
  },
  clockInErrorSubtitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    marginTop: 2,
  },
  clockInErrorMessage: {
    fontFamily: 'DMSans-Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  clockInErrorStatusBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  clockInStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clockInStatusText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },
  clockInRetryBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockInRetryBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 15,
    color: '#fff',
  },
  clockInTicketBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  clockInTicketBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 15,
  },
  clockInDismissBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockInDismissBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },

  // Chunk 46: Shift Dispute Bottom Sheet Styles
  disputeMissingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 6,
  },
  disputeMissingBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  disputeShiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  disputeShiftDate: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  disputeShiftTimes: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
  },
});

















