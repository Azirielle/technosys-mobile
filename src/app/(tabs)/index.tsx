import React, { useState, useEffect, useRef, useMemo } from 'react';
import RNModal from 'react-native-modal';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing, ActivityIndicator, ScrollView, Image, Alert, Platform, FlatList, TextInput, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDistance } from 'geolib';
import MapView, { Marker, Circle, Polyline } from '../../components/MapWrapper';
import { supabase } from '../../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import SupportChatUI from '../../components/SupportChatUI';
import * as Notifications from 'expo-notifications';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAppTheme } from '../../context/ThemeContext';
import { AppThemeColors } from '../../constants/theme';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

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
}

// TECHONOSYS PRO BRAND COLORS
const BRAND = {
  blue: '#1E3A8A',    
  yellow: '#FBBF24',  
  green: '#10B981',   
  red: '#EF4444',     
  lightBg: '#F8FAFC',
};

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    priority_dispatch: "PRIORITY DISPATCH",
    active_ticket: "Active Ticket",
    view_dispatch_details: "View Dispatch Details",
    no_active_deployments: "You have 0 active deployments scheduled.",
    menu: "Menu",
    my_operations: "My Operations",
    schedules: "Schedules",
    payslips: "Payslips",
    file_leave: "File Leave",
    timesheets: "Timesheets",
    announcements: "Announcements",
    my_tools: "My Tools",
    work_orders: "Work Orders",
    clock_in: "Clock In",
    tap_to_verify: "Tap to verify location presence",
    preferences: "Preferences",
    dark_mode: "Dark Mode",
    appearance: "Appearance",
    theme_light: "Light",
    theme_dark: "Dark",
    theme_system: "System",
    language: "Language",
    settings: "Settings",
    equipment: "Equipment",
    support: "Support",
    updates: "Updates",
  },
  tl: {
    priority_dispatch: "APURAHANG MISYON",
    active_ticket: "Aktibong Ticket",
    view_dispatch_details: "Tingnan ang Detalye",
    no_active_deployments: "Wala kang nakatakdang misyon ngayon.",
    menu: "Menu",
    my_operations: "Aking Operasyon",
    schedules: "Mga Iskedyul",
    payslips: "Payslips",
    file_leave: "Mag-File ng Leave",
    timesheets: "Timesheets",
    announcements: "Mga Anunsyo",
    my_tools: "Aking Kagamitan",
    work_orders: "Work Orders",
    clock_in: "Pumasok (Clock In)",
    tap_to_verify: "Pindutin para kumpirmahin ang lokasyon",
    preferences: "Kagustuhan",
    dark_mode: "Dark Mode",
    appearance: "Hitsura",
    theme_light: "Maliwanag",
    theme_dark: "Madilim",
    theme_system: "Sistema",
    language: "Wika",
    settings: "Mga Setting",
    equipment: "Kagamitan",
    support: "Tulong",
    updates: "Mga Update",
  },
  ja: {
    priority_dispatch: "優先派遣",
    active_ticket: "アクティブなチケット",
    view_dispatch_details: "派遣の詳細を見る",
    no_active_deployments: "現在スケジュールされている展開はありません。",
    menu: "メニュー",
    my_operations: "マイオペレーション",
    schedules: "スケジュール",
    my_tools: "マイツール",
    work_orders: "作業指示書",
    clock_in: "出勤する",
    tap_to_verify: "タップして場所を確認",
    preferences: "環境設定",
    dark_mode: "ダークモード",
    appearance: "外観",
    theme_light: "ライト",
    theme_dark: "ダーク",
    theme_system: "システム",
    language: "言語",
    settings: "設定",
    equipment: "機材",
    support: "サポート",
    updates: "更新",
  }
};
export default function HomeScreen() {
  const router = useRouter();
  const pushNotificationState = usePushNotifications();
  const { themeMode, isDark, language, colors, setThemeMode, setLanguage } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  
  const t = (key: string) => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };
  const activeFont = language === 'ja' ? 'System' : 'DMSans-Medium';
  const activeFontBold = language === 'ja' ? 'System' : 'DMSans-Bold';
  
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
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  // Chunk 13.2 States
  const [dtrModalVisible, setDtrModalVisible] = useState(false);
  const [formsModalVisible, setFormsModalVisible] = useState(false);
  const [dtrLogs, setDtrLogs] = useState<any[]>([]);
  const [dtrLoading, setDtrLoading] = useState(false);

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
            
            let title = 'HR Ticket Message';
            let type: 'hr' | 'help' | 'admin' = 'admin';
            let desc = c.content;

            if (isApproved) {
              type = 'hr';
              title = `Ticket Approved (${t?.category || 'HR'})`;
              desc = c.content.replace(/\[DECISION: APPROVED & RESOLVED\]\s*/i, '').replace(/Resolution Note:\s*/i, '');
            } else if (isRefused) {
              type = 'help';
              title = `Ticket Refused (${t?.category || 'HR'})`;
              desc = c.content.replace(/\[DECISION: REFUSED\]\s*/i, '').replace(/Reason:\s*/i, '');
            } else {
              title = `HR Comment (${t?.category || 'Support'})`;
            }

            items.push({
              id: `tc_${c.id}`,
              type,
              title,
              desc: desc.trim(),
              time: formatNotifTime(c.created_at),
              read: readSet.has(`tc_${c.id}`),
              ticketId: c.ticket_id,
              timestamp: new Date(c.created_at).getTime()
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
          items.push({
            id: `ann_${a.id}`,
            type: 'admin',
            title: a.title,
            desc: a.content || 'Company announcement posted.',
            time: formatNotifTime(a.created_at),
            read: readSet.has(`ann_${a.id}`),
            timestamp: new Date(a.created_at).getTime()
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
          desc: 'Operational alerts and HR ticket updates will appear here in real time.',
          time: 'Active',
          read: true,
          timestamp: Date.now()
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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('tool_assignments')
        .select('id, quantity, borrowed_at, returned_at, status, notes, tool_catalog ( id, name, image_url )')
        .eq('technician_id', user.id)
        .order('borrowed_at', { ascending: false });
      
      setTools(data || []);
    }
    setToolsLoading(false);
  };

  // Chunk 16: Support & Ticketing
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [createTicketMode, setCreateTicketMode] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  const [ticketForm, setTicketForm] = useState({ title: '', category: 'HR & Payroll', description: '' });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const TICKET_CATEGORIES = ['HR & Payroll', 'IT & App Support', 'Equipment / Tools', 'Schedule & Dispatch'];

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

  
  const downloadPayslip = async () => {
    if (!payslipViewRef.current) return;
    try {
      const uri = await payslipViewRef.current.capture();
      const Sharing = require('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        safeAlert('Error', 'Sharing is not available on this device');
      }
    } catch (err) {
      safeAlert('Error', 'Failed to save image');
    }
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
        setTicketForm({ title: '', category: 'HR & Payroll', description: '' });
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
  const [workOrdersModalVisible, setWorkOrdersModalVisible] = useState(false);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);

  // Chunk 20: Payslips Feature
  const [payslipsModalVisible, setPayslipsModalVisible] = useState(false);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const payslipViewRef = useRef<any>(null);
  const [aiInitialQuery, setAiInitialQuery] = useState('');

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

  // Timesheets Feature
  const [timesheetModalVisible, setTimesheetModalVisible] = useState(false);
    const [hasClockedInToday, setHasClockedInToday] = useState(false);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [selectedTimeLog, setSelectedTimeLog] = useState<any>(null);
  const [timesheetLoading, setTimesheetLoading] = useState(false);

  // Schedules Feature
  const [schedulesModalVisible, setSchedulesModalVisible] = useState(false);
  const [schedulesList, setSchedulesList] = useState<any[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  // Preferences Feature
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);


  const fetchPayslips = async () => {
    setPayslipsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('payslips')
        .select('*, profiles(full_name)')
        .eq('technician_id', user.id)
        .eq('status', 'published')
        .order('period_start', { ascending: false });
      
      setPayslips(data || []);
    }
    setPayslipsLoading(false);
  };

  const fetchLeaveRequests = async () => {
    setLeaveLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('leave_requests')
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
        .from('leave_requests')
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
        .from('time_logs')
        .select('*')
        .eq('technician_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setTimeLogs(data);
    }
    setTimesheetLoading(false);
  };

  const fetchSchedulesList = async () => {
    setSchedulesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('technician_id', user.id)
        .order('start_time', { ascending: false });
      
      if (data) setSchedulesList(data);
    }
    setSchedulesLoading(false);
  };

  const fetchWorkOrders = async () => {
    setWorkOrdersLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('work_orders')
        .select('*')
        .eq('technician_id', user.id)
        .order('created_at', { ascending: false });
      
      setWorkOrders(data || []);
    }
    setWorkOrdersLoading(false);
  };

  const updateWorkOrderStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, status: newStatus } : wo));
    
    const { error } = await supabase
      .from('work_orders')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (error) {
      safeAlert('Error', 'Failed to update work order status.');
      fetchWorkOrders(); // Revert optimistic update
    }
  };

  const fetchDtrLogs = async () => {
    setDtrLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('time_logs')
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
  const [userLoc, setUserLoc] = useState<{lat: number, lon: number} | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  
  const [profile, setProfile] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);

  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadData() {
        (async () => { try { const { status } = await Location.requestForegroundPermissionsAsync(); if (status === 'granted') { const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setUserLoc({ lat: loc.coords.latitude, lon: loc.coords.longitude }); } } catch (e) {} })();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profileData);

      const { data: scheduleData } = await supabase
        .from('schedules')
        .select('*')
        .eq('technician_id', user.id)
        .order('start_time', { ascending: false })
        .limit(1)
        .single();
      
      if (scheduleData) setSchedule(scheduleData);

      // Check if user clocked in today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const { data: todaysLog } = await supabase
        .from('time_logs')
        .select('id, app_time_out')
        .eq('technician_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .limit(1);

      if (todaysLog && todaysLog.length > 0) {
        setHasClockedInToday(true);
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
            Notifications.scheduleNotificationAsync({
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
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, []);

  const openMenu = () => { setMenuVisible(true); };

  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 250, easing: Easing.in(Easing.poly(4)), useNativeDriver: true }).start(() => setMenuVisible(false));
  };

  const handleClockIn = async () => {
    if (!schedule) {
       Alert.alert("No Schedule", "You don't have an active dispatch scheduled today.");
       return;
    }

    setClockInModal(true);
    setLocationStatus('verifying');
    
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('fallback');
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLoc({ lat: location.coords.latitude, lon: location.coords.longitude });
      
      const distance = getDistance(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: schedule.geofence_lat, longitude: schedule.geofence_lon }
      );

      if (distance <= schedule.geofence_radius) {
        // Success inside geofence
        await supabase.from('time_logs').insert({
          technician_id: profile?.id,
          app_time_in: new Date().toISOString(),
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          status: 'verified',
          geofence_status: 'inside'
        });
        setLocationStatus('success');
        setHasClockedInToday(true);
        setTimeout(() => setClockInModal(false), 2000);
      } else {
        // Fallback due to distance
        setLocationStatus('fallback');
      }
    } catch (e) {
      setLocationStatus('fallback');
    }
  };

  const handleVisualOverride = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required for visual override.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      setUploadingSelfie(true);
      try {
        const fileExt = result.assets[0].uri.split('.').pop() || 'jpeg';
        const fileName = `${profile?.id}-${Date.now()}.${fileExt}`;
        
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        
        await supabase.storage.from('dtr-selfies').upload(fileName, blob);
        const { data: publicUrlData } = supabase.storage.from('dtr-selfies').getPublicUrl(fileName);

        await supabase.from('time_logs').insert({
          technician_id: profile?.id,
          app_time_in: new Date().toISOString(),
          latitude: userLoc?.lat || 0,
          longitude: userLoc?.lon || 0,
          status: 'pending_review',
          geofence_status: 'outside',
          photo_url: publicUrlData.publicUrl
        });

        Alert.alert('Override Submitted', 'Your photo has been sent to HR for review.');
        setClockInModal(false);
        setHasClockedInToday(true);
      } catch (err) {
        console.error(err);
        Alert.alert('Upload Failed', 'There was an issue uploading your photo.');
      }
      setUploadingSelfie(false);
    }
  };

  return (
    <View style={[styles.masterContainer, { backgroundColor: colors.bg }]}>
      <LinearGradient colors={isDark ? ['#0B0F17', '#111827', '#0B0F17'] : ['#FFFFFF', '#F8FAFC', '#E2E8F0']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={[styles.headerBtnOutline, { backgroundColor: isDark ? colors.subCard : 'transparent' }]} onPress={() => setProfileModalVisible(true)}>
            <Feather name="user" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Image source={require('../../../assets/logo.png')} style={{ width: 45, height: 45, resizeMode: 'contain' }} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>{profile ? profile.full_name : 'TechnoCycle'}</Text>
          </View>
          <TouchableOpacity style={[styles.headerBtnOutline, { backgroundColor: isDark ? colors.subCard : 'transparent' }]} onPress={() => setNotifVisible(true)}>
            <Feather name="bell" size={24} color={colors.text} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>
          {hasClockedInToday ? (
            <View style={[styles.clockInCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4', borderColor: isDark ? '#065F46' : '#BBF7D0', borderWidth: 1 }]} >
              <View style={[styles.clockInIconContainer, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#BBF7D0' }]}>
                <Feather name="check" size={32} color={BRAND.green} />
              </View>
              <View style={styles.clockInTextContainer}>
                <Text style={[styles.clockInTitle, { color: BRAND.green }]}>Clock In Done</Text>
                <Text style={[styles.clockInSub, { color: colors.textMuted }]}>Wait for admin to process clock-out</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.clockInCard, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : BRAND.blue, borderColor: isDark ? colors.cardBorder : 'transparent', borderWidth: isDark ? 1 : 0 }]} 
              activeOpacity={0.8} 
              onPress={handleClockIn}
            >
              <View style={[styles.clockInIconContainer, { backgroundColor: isDark ? colors.subCard : '#EFF6FF' }]}>
                <Ionicons name="scan-outline" size={32} color={colors.brandBlue} />
              </View>
              <View style={styles.clockInTextContainer}>
                <Text style={[styles.clockInTitle, { color: colors.text }]}>{t('clock_in')}</Text>
                <Text style={[styles.clockInSub, { color: colors.textMuted }]}>{t('tap_to_verify')}</Text>
              </View>
              <Feather name="arrow-right" size={24} color={colors.brandBlue} />
            </TouchableOpacity>
          )}

          <View style={styles.bubbleRow}>
            <TouchableOpacity style={styles.bubbleBtn} onPress={() => { fetchEquipment(); setEquipModalVisible(true); }}>
              <View style={[styles.bubbleCircle, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : BRAND.yellow }]}>
                <Feather name="tool" size={24} color={BRAND.yellow} />
              </View>
              <Text style={[styles.bubbleText, { color: colors.text }]}>Equipment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bubbleBtn} onPress={() => { fetchTickets(); setSupportModalVisible(true); }}>
              <View style={[styles.bubbleCircle, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : BRAND.green }]}>
                <Feather name="headphones" size={24} color={BRAND.green} />
              </View>
              <Text style={[styles.bubbleText, { color: colors.text }]}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bubbleBtn} onPress={() => { fetchAnnouncements(); setUpdatesModalVisible(true); }}>
              <View style={[styles.bubbleCircle, { backgroundColor: colors.card, shadowColor: isDark ? '#000' : BRAND.red }]}>
                <Feather name="radio" size={24} color={BRAND.red} />
              </View>
              <Text style={[styles.bubbleText, { color: colors.text }]}>Updates</Text>
            </TouchableOpacity>
          </View>

          {schedule ? (
            <TouchableOpacity 
              style={[styles.dispatchWidget, { backgroundColor: colors.card, borderColor: isDark ? colors.cardBorder : '#DBEAFE' }]} 
              activeOpacity={0.8} 
              onPress={() => setDispatchVisible(true)}
            >
              <View style={[styles.dispatchHeader, { backgroundColor: isDark ? colors.subCard : '#EFF6FF', borderBottomColor: isDark ? colors.cardBorder : '#DBEAFE' }]}>
                <View style={[styles.dispatchIconContainer, { backgroundColor: isDark ? '#1E293B' : '#DBEAFE' }]}>
                  <Feather name="navigation" size={16} color={colors.brandBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dispatchWidgetTitle, { fontFamily: activeFontBold, color: colors.brandBlue }]}>{t('priority_dispatch')}</Text>
                  <Text style={[styles.dispatchWidgetSub, { fontFamily: activeFont, color: colors.textMuted }]}>{t('active_ticket')}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.brandBlue} />
              </View>
              <View style={styles.dispatchBody}>
                <Text style={[styles.dispatchDestination, { color: colors.text }]} numberOfLines={2}>
                  {schedule.location}
                </Text>
                <Text style={[styles.dispatchClient, { color: colors.textMuted }]}>{schedule.client_name}</Text>
              </View>
              <View style={[styles.dispatchAction, { backgroundColor: colors.brandBlue }]}>
                <Text style={[styles.dispatchActionText, { fontFamily: activeFontBold }]}>{t('view_dispatch_details')}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: isDark ? 1 : 0, shadowColor: isDark ? '#000' : '#C0C2C9' }]}>
              <Text style={[styles.infoTitle, { fontFamily: activeFontBold, color: colors.text }]}>{t('priority_dispatch')}</Text>
              <Text style={[styles.infoSub, { fontFamily: activeFont, color: colors.textMuted }]}>{t('no_active_deployments')}</Text>
            </View>
          )}
        </View>

        {/* MENU PILL */}
        <View style={styles.floatingMenuContainer}>
          <TouchableOpacity style={styles.menuPill} activeOpacity={0.9} onPress={openMenu}>
            <Text style={[styles.menuPillText, { fontFamily: activeFontBold }]}>{t('menu')}</Text>
          </TouchableOpacity>
        </View>

        {/* MENU OVERLAY */}
        <RNModal isVisible={menuVisible}   onBackdropPress={() => setMenuVisible(false)} onBackButtonPress={() => setMenuVisible(false)} onSwipeComplete={() => setMenuVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={[styles.menuOverlay, { opacity: 1 }]}>
            <View style={styles.menuContent}>
              <SafeAreaView style={{flex: 1}}>
                <View style={styles.menuHeaderRow}>
                  <View style={{width: 32}}/>
                  <Text style={[styles.menuHeaderText, { fontFamily: activeFontBold }]}>{t('menu')}</Text>
                  <TouchableOpacity onPress={closeMenu} style={styles.closeBtnTop}>
                    <Feather name="x" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={styles.menuScroll} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.categoryTitle, { fontFamily: activeFontBold }]}>{t('my_operations')}</Text>
                  <View style={styles.menuGrid}>
                    <MenuGridItem icon="calendar" label={t('schedules')} fontFamily={activeFontBold} color={BRAND.yellow} onPress={() => { fetchSchedulesList(); setSchedulesModalVisible(true); }} />
                    <MenuGridItem icon="tool" label={t('my_tools')} fontFamily={activeFontBold} color={BRAND.yellow} onPress={() => { fetchEquipment(); setEquipModalVisible(true); }} />
                    <MenuGridItem icon="clipboard" label={t('work_orders')} fontFamily={activeFontBold} color={BRAND.yellow} onPress={() => { fetchWorkOrders(); setWorkOrdersModalVisible(true); }} />
                  </View>
                  <Text style={[styles.categoryTitle, { fontFamily: activeFontBold }]}>My HR & Pay</Text>
                  <View style={styles.menuGrid}>
                    <MenuGridItem icon="dollar-sign" label={t('payslips')} fontFamily={activeFontBold} color={BRAND.green} onPress={() => { fetchPayslips(); setPayslipsModalVisible(true); }} />
                    <MenuGridItem icon="sun" label={t('file_leave')} fontFamily={activeFontBold} color={BRAND.red} onPress={() => { setMenuVisible(false); setAiInitialQuery('I would like to file a leave of absence.'); setTimeout(() => setSupportModalVisible(true), 500); }} />
                    <MenuGridItem icon="clock" label={t('timesheets')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { fetchTimeLogs(); setTimesheetModalVisible(true); }} />
                  </View>
                  <Text style={[styles.categoryTitle, { fontFamily: activeFontBold }]}>Company & Support</Text>
                  <View style={styles.menuGrid}>
                    <MenuGridItem icon="bell" label={t('announcements')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { fetchAnnouncements(); setUpdatesModalVisible(true); }} />
                    <MenuGridItem icon="help-circle" label={t('support')} fontFamily={activeFontBold} color={BRAND.red} onPress={() => { fetchTickets(); setSupportModalVisible(true); }} />
                    <MenuGridItem icon="settings" label={t('preferences')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { setMenuVisible(false); setPreferencesModalVisible(true); }} />
                  </View>
                  <View style={{height: 180}} />
                </ScrollView>
                <View style={styles.bottomCloseContainer}>
                   <TouchableOpacity style={styles.flowerCloseBtn} onPress={closeMenu} activeOpacity={0.8}>
                      <View style={{ width: 80, height: 80, justifyContent: 'center', alignItems: 'center' }}>
                          <Animated.View style={[styles.flowerRing1, { position: 'absolute', transform: [{ scale: auraAnim }] }]} />
                          <View style={[styles.flowerRing2, { position: 'absolute' }]}>
                             <Text style={styles.flowerText}>Tap to{"\n"}close</Text>
                          </View>
                       </View>
                   </TouchableOpacity>
                </View>
              </SafeAreaView>
              </View>
            </View>
        </RNModal>

        {/* VERIFICATION MODAL */}
        <RNModal isVisible={clockInModal}   onBackdropPress={() => setClockInModal(false)} onBackButtonPress={() => setClockInModal(false)} onSwipeComplete={() => setClockInModal(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
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
                      <Feather name="x" size={24} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.fallbackSub}>You are outside the target green zone.</Text>
                  <View style={styles.mapContainer}>
                    {userLoc && schedule && (
                      <MapView provider={'google'} style={styles.map} initialRegion={{ latitude: userLoc.lat, longitude: userLoc.lon, latitudeDelta: 0.005, longitudeDelta: 0.005 }}>
                        <Circle center={{latitude: schedule.geofence_lat, longitude: schedule.geofence_lon}} radius={schedule.geofence_radius} strokeColor="rgba(16, 185, 129, 0.5)" fillColor="rgba(16, 185, 129, 0.2)" />
                        <Marker coordinate={{latitude: userLoc.lat, longitude: userLoc.lon}} />
                      </MapView>
                    )}
                  </View>
                  <TouchableOpacity style={styles.fallbackBtn} onPress={handleVisualOverride} disabled={uploadingSelfie}>
                    {uploadingSelfie ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.fallbackBtnText}>Submit Photo Override</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </RNModal>

        {/* PROFILE MODAL (Bottom Sheet) */}
        <RNModal isVisible={profileModalVisible}   onBackdropPress={() => setProfileModalVisible(false)} onBackButtonPress={() => setProfileModalVisible(false)} onSwipeComplete={() => setProfileModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              {/* Handle */}
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
              
              {/* Header: Name, Role, Status */}
              <View style={styles.profileHeader}>
                <View style={[styles.profileAvatar, { backgroundColor: isDark ? colors.subCard : '#EFF6FF' }]}>
                  <Feather name="user" size={32} color={colors.brandBlue} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, { color: colors.text }]}>{profile ? profile.full_name : 'TechnoCycle'}</Text>
                  <Text style={[styles.profileRole, { color: colors.textMuted }]}>{profile ? profile.role.toUpperCase() : 'TECHNICIAN'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Online</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeProfileBtn} onPress={() => setProfileModalVisible(false)}>
                <Feather name="x" size={24} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Menu Items */}
              <View style={styles.profileMenu}>
                <TouchableOpacity style={[styles.profileMenuItem, { borderBottomColor: isDark ? colors.border : '#F1F5F9' }]} onPress={() => { setProfileModalVisible(false); fetchTimeLogs(); setTimesheetModalVisible(true); }}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: isDark ? colors.subCard : '#E0F2FE' }]}>
                    <Feather name="clock" size={20} color="#0EA5E9" />
                  </View>
                  <Text style={[styles.profileMenuText, { color: colors.text }]}>My DTR</Text>
                  <Feather name="chevron-right" size={20} color={colors.textSubtle} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.profileMenuItem, { borderBottomColor: isDark ? colors.border : '#F1F5F9' }]} onPress={() => { setFormsModalVisible(true); }}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: isDark ? colors.subCard : '#FEF3C7' }]}>
                    <Feather name="file-text" size={20} color="#F59E0B" />
                  </View>
                  <Text style={[styles.profileMenuText, { color: colors.text }]}>Company Forms and handbooks</Text>
                  <Feather name="chevron-right" size={20} color={colors.textSubtle} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.profileMenuItem, { borderBottomColor: isDark ? colors.border : '#F1F5F9' }]} 
                  onPress={() => { 
                    setProfileModalVisible(false); 
                    setTimeout(() => setPreferencesModalVisible(true), 250); 
                  }}
                >
                  <View style={[styles.profileMenuIcon, { backgroundColor: isDark ? colors.subCard : '#F1F5F9' }]}>
                    <Feather name="sliders" size={20} color={colors.brandBlue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileMenuText, { color: colors.text }]}>{t('preferences')}</Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
                      {language.toUpperCase()} • {themeMode === 'system' ? 'System' : isDark ? 'Dark' : 'Light'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.textSubtle} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.profileMenuItem, { borderBottomWidth: 0, marginTop: 16 }]} onPress={() => setLogoutModalVisible(true)}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }]}>
                    <Feather name="log-out" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.profileMenuText, { color: '#EF4444' }]}>Log Out</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </RNModal>

        {/* DTR MODAL */}
        <RNModal isVisible={dtrModalVisible}   onBackdropPress={() => setDtrModalVisible(false)} onBackButtonPress={() => setDtrModalVisible(false)} onSwipeComplete={() => setDtrModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
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
                      <View style={[styles.statusBadge, { backgroundColor: log.status === 'verified' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5') : (isDark ? 'rgba(251, 191, 36, 0.2)' : '#FEF3C7') }]}>
                        <Text style={[styles.statusText, { color: log.status === 'verified' ? BRAND.green : BRAND.yellow }]}>{log.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))}
                  {dtrLogs.length === 0 && <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 40 }}>No logs found.</Text>}
                </ScrollView>
              )}
            </View>
          </View>
        </RNModal>

        {/* FORMS MODAL */}
        <RNModal isVisible={formsModalVisible}   onBackdropPress={() => setFormsModalVisible(false)} onBackButtonPress={() => setFormsModalVisible(false)} onSwipeComplete={() => setFormsModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '60%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Company Forms</Text>
                <TouchableOpacity onPress={() => setFormsModalVisible(false)}><Feather name="x" size={24} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
                {['Employee Code of Conduct', 'Leave Policy', 'Equipment Handling Manual'].map((form, idx) => (
                  <TouchableOpacity key={idx} style={[styles.profileMenuItem, { borderBottomColor: isDark ? colors.border : '#F1F5F9' }]} onPress={() => safeAlert('Coming Soon', 'This document is not yet available.')}>
                    <View style={[styles.profileMenuIcon, { backgroundColor: isDark ? colors.subCard : '#F1F5F9' }]}><Feather name="file" size={20} color={colors.brandBlue} /></View>
                    <Text style={[styles.profileMenuText, { color: colors.text }]}>{form}</Text>
                    <Feather name="download" size={20} color={colors.brandBlue} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </RNModal>

        {/* UNIFIED CANONICAL PREFERENCES MODAL */}
        <RNModal 
          isVisible={preferencesModalVisible}   
          onBackdropPress={() => setPreferencesModalVisible(false)} 
          onBackButtonPress={() => setPreferencesModalVisible(false)} 
          onSwipeComplete={() => setPreferencesModalVisible(false)} 
          swipeDirection={['down']} 
          propagateSwipe={true} 
          swipeThreshold={50} 
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { backgroundColor: colors.card, borderTopColor: colors.cardBorder, paddingBottom: 40 }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
              
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
                    { code: 'tl' as const, label: 'Filipino', tag: 'TL', font: 'DMSans-Bold' },
                    { code: 'ja' as const, label: '日本語', tag: 'JA', font: 'System' },
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

                {/* APP TELEMETRY & BUILD INFO */}
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
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: colors.textMuted }}>v0.5.0 • Channel: preview</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                    <Text style={{ fontFamily: activeFontBold, fontSize: 11, color: BRAND.green }}>ONLINE</Text>
                  </View>
                </View>
                
              </View>
            </View>
          </View>
        </RNModal>

        {/* LOGOUT CONFIRMATION MODAL */}
        <RNModal isVisible={logoutModalVisible}   onBackdropPress={() => setLogoutModalVisible(false)} onBackButtonPress={() => setLogoutModalVisible(false)} onSwipeComplete={() => setLogoutModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
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
        <RNModal isVisible={notifVisible}   onBackdropPress={() => setNotifVisible(false)} onBackButtonPress={() => setNotifVisible(false)} onSwipeComplete={() => setNotifVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%', backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
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
                renderItem={({ item: notif }) => {
                  let icon = 'bell';
                  let color = '#64748B';
                  let bgColor = isDark ? colors.subCard : '#F1F5F9';
                  if (notif.type === 'dispatch') { icon = 'navigation'; color = '#EF4444'; bgColor = isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2'; }
                  if (notif.type === 'hr') { icon = 'check-circle'; color = '#10B981'; bgColor = isDark ? 'rgba(16, 185, 129, 0.2)' : '#D1FAE5'; }
                  if (notif.type === 'tool') { icon = 'tool'; color = '#F59E0B'; bgColor = isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7'; }
                  if (notif.type === 'admin') { icon = 'file-text'; color = colors.brandBlue; bgColor = isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE'; }
                  if (notif.type === 'help') { icon = 'life-buoy'; color = '#8B5CF6'; bgColor = isDark ? 'rgba(139, 92, 246, 0.2)' : '#EDE9FE'; }

                  return (
                    <TouchableOpacity 
                      style={[styles.notifItem, { borderBottomColor: isDark ? colors.border : '#F1F5F9' }, !notif.read && (isDark ? { backgroundColor: colors.subCard } : styles.notifItemUnread)]}
                      onPress={() => {
                        markNotificationRead(notif.id);
                        if (notif.ticketId) {
                          setSelectedChatTicketId(notif.ticketId);
                          setNotifVisible(false);
                          setSupportModalVisible(true);
                        } else {
                          setSelectedNotif(notif);
                        }
                      }}
                    >
                      <View style={[styles.notifIconCircle, { backgroundColor: bgColor }]}>
                        <Feather name={icon as any} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifItemTitle, { color: colors.text }]}>{notif.title}</Text>
                        <Text style={[styles.notifItemDesc, { color: colors.textMuted }]}>{notif.desc}</Text>
                        <Text style={[styles.notifItemTime, { color: colors.textSubtle }]}>{notif.time}</Text>
                      </View>
                      {!notif.read && <View style={[styles.notifUnreadDot, { backgroundColor: colors.brandBlue }]} />}
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

        {/* PRIORITY DISPATCH MODAL */}
        <RNModal isVisible={dispatchVisible}   onBackdropPress={() => setDispatchVisible(false)} onBackButtonPress={() => setDispatchVisible(false)} onSwipeComplete={() => setDispatchVisible(false)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setDispatchVisible(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: colors.text, marginLeft: 8 }}>Dispatch Details</Text>
            </View>
            
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.cardBorder }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={[styles.notifIconCircle, { backgroundColor: isDark ? '#1E293B' : '#DBEAFE', marginRight: 16 }]}>
                  <Feather name="navigation" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#3B82F6', letterSpacing: 1, marginBottom: 4 }}>
                    ACTIVE TICKET
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: colors.textSubtle }}>
                    Assigned 10m ago
                  </Text>
                </View>
              </View>
              
              <View style={styles.payslipDivider} />
              
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, marginBottom: 8, marginTop: 8 }}>
                {schedule?.client_name || 'N/A'}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                <Feather name="map-pin" size={16} color={colors.textMuted} style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.textMuted, lineHeight: 22, flex: 1 }}>
                  {schedule?.location || 'N/A'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 }}>
                <Feather name="info" size={16} color={colors.textMuted} style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: colors.textMuted, lineHeight: 22, flex: 1 }}>
                  {schedule?.remarks || 'Perform standard maintenance checks on network rack cooling systems.'}
                </Text>
              </View>

              <View style={styles.payslipDivider} />

              {schedule && userLoc && (
                <View style={{ height: 180, borderRadius: 12, overflow: 'hidden', marginBottom: 16, marginTop: 8, borderWidth: 1, borderColor: colors.cardBorder }}>
                  <MapView provider={'google'} style={{ flex: 1 }} initialRegion={{ latitude: userLoc.lat, longitude: userLoc.lon, latitudeDelta: Math.abs(schedule.geofence_lat - userLoc.lat) * 2.5 || 0.05, longitudeDelta: Math.abs(schedule.geofence_lon - userLoc.lon) * 2.5 || 0.05 }}>
                    <Marker coordinate={{latitude: userLoc.lat, longitude: userLoc.lon}} pinColor='blue' />
                    <Marker coordinate={{latitude: schedule.geofence_lat, longitude: schedule.geofence_lon}} pinColor='red' />
                    <Polyline coordinates={[{latitude: userLoc.lat, longitude: userLoc.lon}, {latitude: schedule.geofence_lat, longitude: schedule.geofence_lon}]} strokeColor='#3B82F6' strokeWidth={4} lineDashPattern={[10, 10]} />
                  </MapView>
                </View>
              )}

              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                
                <TouchableOpacity style={[styles.submitBtn, { flex: 2, backgroundColor: '#3B82F6' }]} onPress={() => {
                  Linking.openURL('https://www.google.com/maps'); setDispatchVisible(false); }}>
                  <Text style={styles.submitBtnText}>Acknowledge & Go</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        {/* NOTIFICATION DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <RNModal isVisible={!!selectedNotif}   onBackdropPress={() => setSelectedNotif(null)} onBackButtonPress={() => setSelectedNotif(null)} onSwipeComplete={() => setSelectedNotif(null)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>
            {selectedNotif && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                  <TouchableOpacity onPress={() => setSelectedNotif(null)} style={{ padding: 8, marginLeft: -8 }}>
                    <Feather name="arrow-left" size={24} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Notification Details</Text>
                </View>
                
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={[styles.notifIconCircle, { 
                      backgroundColor: selectedNotif.type === 'dispatch' ? '#FEE2E2' : 
                                     selectedNotif.type === 'hr' ? '#D1FAE5' : 
                                     selectedNotif.type === 'tool' ? '#FEF3C7' : 
                                     selectedNotif.type === 'admin' ? '#DBEAFE' : '#EDE9FE',
                      marginRight: 16
                    }]}>
                      <Feather name={
                        selectedNotif.type === 'dispatch' ? 'navigation' :
                        selectedNotif.type === 'hr' ? 'check-circle' :
                        selectedNotif.type === 'tool' ? 'tool' :
                        selectedNotif.type === 'admin' ? 'file-text' : 'life-buoy'
                      } size={24} color={
                        selectedNotif.type === 'dispatch' ? '#EF4444' :
                        selectedNotif.type === 'hr' ? '#10B981' :
                        selectedNotif.type === 'tool' ? '#F59E0B' :
                        selectedNotif.type === 'admin' ? '#3B82F6' : '#8B5CF6'
                      } />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginBottom: 4 }}>
                        {selectedNotif.title}
                      </Text>
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: '#94A3B8' }}>
                        {selectedNotif.time}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.payslipDivider} />
                  
                  <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: '#475569', lineHeight: 24, marginTop: 8 }}>
                    {selectedNotif.desc}
                  </Text>
                </View>
              </>
            )}
          </View>
        </RNModal>

        {/* EQUIPMENT MODAL */}
        <RNModal isVisible={equipModalVisible}   onBackdropPress={() => setEquipModalVisible(false)} onBackButtonPress={() => setEquipModalVisible(false)} onSwipeComplete={() => setEquipModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>My Equipment</Text>
                <TouchableOpacity onPress={() => setEquipModalVisible(false)}>
                  <Feather name="x" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
              
              {toolsLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={BRAND.yellow} />
                </View>
              ) : (
                <FlatList
                  data={tools}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                  ListEmptyComponent={() => (
                    <View style={{ padding: 32, alignItems: 'center' }}>
                      <Feather name="tool" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                        You currently have no equipment checked out.
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <View style={styles.equipItem}>
                      <View style={styles.equipImagePlaceholder}>
                        {item.tool_catalog?.image_url ? (
                          <Image source={{ uri: item.tool_catalog.image_url }} style={styles.equipImg} />
                        ) : (
                          <Feather name="tool" size={24} color="#94A3B8" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.equipTitle}>{item.tool_catalog?.name || 'Unknown Tool'}</Text>
                        <Text style={styles.equipSub}>Qty: {item.quantity}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <View style={[styles.equipStatusBadge, item.status === 'borrowed' ? styles.statusActive : styles.statusOverdue]}>
                            <Text style={[styles.equipStatusText, item.status === 'borrowed' ? styles.textActive : styles.textOverdue]}>
                              {item.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </RNModal>

        {/* SUPPORT MODAL */}
        <RNModal isVisible={supportModalVisible}   onBackdropPress={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); }} onBackButtonPress={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); }} onSwipeComplete={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); }} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}><SupportChatUI onClose={() => { setSupportModalVisible(false); setSelectedChatTicketId(null); }} initialQuery={aiInitialQuery} ticketId={selectedChatTicketId || undefined} /></RNModal>

        {/* SUPPORT TICKET DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <RNModal isVisible={!!selectedTicket}   onBackdropPress={() => setSelectedTicket(null)} onBackButtonPress={() => setSelectedTicket(null)} onSwipeComplete={() => setSelectedTicket(null)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>
            {/* --- DETAILED VIEW: TICKET --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setSelectedTicket(null)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color="#0F172A" />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Ticket Details</Text>
            </View>
            
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', flex: 1, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 4 }}>
                    {selectedTicket?.title}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: '#64748B' }}>
                    {selectedTicket?.category} • {selectedTicket?.created_at ? new Date(selectedTicket.created_at).toLocaleString() : ''}
                  </Text>
                </View>
                <View style={[styles.ticketBadge, selectedTicket?.status === 'open' ? styles.badgeOpen : styles.badgeResolved]}>
                  <Text style={[styles.ticketBadgeText, selectedTicket?.status === 'open' ? styles.badgeTextOpen : styles.badgeTextResolved]}>
                    {selectedTicket?.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.payslipDivider} />
              
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#0F172A', marginBottom: 8 }}>DESCRIPTION</Text>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: '#475569', lineHeight: 22 }}>
                  {selectedTicket?.description}
                </Text>
              </ScrollView>
            </View>
          </View>
        </RNModal>

        {/* UPDATES MODAL */}
        <RNModal isVisible={updatesModalVisible}   onBackdropPress={() => setUpdatesModalVisible(false)} onBackButtonPress={() => setUpdatesModalVisible(false)} onSwipeComplete={() => setUpdatesModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '85%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Company Updates</Text>
                <TouchableOpacity onPress={() => setUpdatesModalVisible(false)}>
                  <Feather name="x" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {announcementsLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={BRAND.red} />
                </View>
              ) : (
                <FlatList
                  data={announcements}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                  ListEmptyComponent={() => (
                    <View style={{ padding: 32, alignItems: 'center' }}>
                      <Feather name="radio" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                        No new announcements right now.
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                          <Feather name="user" size={20} color={BRAND.blue} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 15, color: '#0F172A' }}>{item.profiles?.full_name || 'Admin'}</Text>
                          <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: '#64748B' }}>
                            {new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <TouchableOpacity hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} onPress={() => safeAlert("Options", "You can report this announcement if you have concerns.")}>
                          <Feather name="more-horizontal" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A', marginBottom: 4 }}>{item.title}</Text>
                      <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: '#334155', lineHeight: 22, marginBottom: 16 }}>
                        {item.content}
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </RNModal>

        

        {/* WORK ORDERS MODAL */}
        <RNModal isVisible={workOrdersModalVisible}   onBackdropPress={() => setWorkOrdersModalVisible(false)} onBackButtonPress={() => setWorkOrdersModalVisible(false)} onSwipeComplete={() => setWorkOrdersModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '85%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>My Work Orders</Text>
                <TouchableOpacity onPress={() => setWorkOrdersModalVisible(false)}>
                  <Feather name="x" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {workOrdersLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={BRAND.yellow} />
                </View>
              ) : (
                <FlatList
                  data={workOrders}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                  ListEmptyComponent={() => (
                    <View style={{ padding: 32, alignItems: 'center' }}>
                      <Feather name="clipboard" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                        You have no active work orders.
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => (
                    <View style={styles.woItem}>
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={styles.woTitle}>{item.title}</Text>
                        <Text style={styles.woDesc}>{item.description}</Text>
                        {item.due_date && (
                          <Text style={styles.woDate}>
                            <Feather name="calendar" size={12} /> Due: {new Date(item.due_date).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                      
                      <TouchableOpacity 
                        style={[styles.woActionBtn, item.status === 'completed' ? styles.woCompleted : styles.woPending]}
                        onPress={() => updateWorkOrderStatus(item.id, item.status === 'completed' ? 'pending' : 'completed')}
                      >
                        <Feather name={item.status === 'completed' ? "check" : "circle"} size={20} color={item.status === 'completed' ? BRAND.green : '#94A3B8'} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </RNModal>

        {/* SCHEDULES MODAL (LIST VIEW) */}
        <RNModal isVisible={schedulesModalVisible}   onBackdropPress={() => setSchedulesModalVisible(false)} onBackButtonPress={() => setSchedulesModalVisible(false)} onSwipeComplete={() => setSchedulesModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '85%' }]}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>My Schedules</Text>
                <TouchableOpacity onPress={() => setSchedulesModalVisible(false)}>
                  <Feather name="x" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {schedulesLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={BRAND.blue} />
                </View>
              ) : (
                <FlatList
                  data={schedulesList}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                  ListEmptyComponent={() => (
                    <View style={{ padding: 32, alignItems: 'center' }}>
                      <Feather name="calendar" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                      <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
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
                            <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                              <Feather name="clock" size={12} color={BRAND.blue} style={{ marginRight: 4 }} />
                              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 11, color: BRAND.blue }}>
                                {item.start_time ? new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                              </Text>
                            </View>
                            <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: '#64748B' }}>
                                {item.start_time ? new Date(item.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '---'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={20} color="#CBD5E1" />
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </RNModal>

        {/* SCHEDULES DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <RNModal isVisible={!!selectedSchedule}   onBackdropPress={() => setSelectedSchedule(null)} onBackButtonPress={() => setSelectedSchedule(null)} onSwipeComplete={() => setSelectedSchedule(null)} swipeDirection={undefined} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>
            {/* --- DETAILED VIEW: SCHEDULE --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setSelectedSchedule(null)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color="#0F172A" />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Schedule Details</Text>
            </View>
            
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 4 }}>
                    {selectedSchedule?.client_name}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 14, color: '#64748B' }}>
                    {selectedSchedule?.location}
                  </Text>
                </View>
                {selectedSchedule?.is_vip_hook && (
                  <View style={{ backgroundColor: BRAND.yellow, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 10, color: '#fff' }}>VIP</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.payslipDivider} />
              
              <View style={styles.payslipLine}>
                <Text style={styles.payslipLineLabel}>Start Time</Text>
                <Text style={styles.payslipLineValue}>
                  {selectedSchedule?.start_time ? new Date(selectedSchedule.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                </Text>
              </View>
              
              <View style={styles.payslipLine}>
                <Text style={styles.payslipLineLabel}>End Time</Text>
                <Text style={styles.payslipLineValue}>
                  {selectedSchedule?.end_time ? new Date(selectedSchedule.end_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                </Text>
              </View>
              
              <View style={styles.payslipDivider} />
              
              <View style={styles.payslipLine}>
                <Text style={styles.payslipLineLabel}>Attendance Mode</Text>
                <Text style={styles.payslipLineValue}>
                  {selectedSchedule?.attendance_mode ? selectedSchedule.attendance_mode.toUpperCase() : 'STANDARD'}
                </Text>
              </View>

              {selectedSchedule?.attendance_tracking_mode && (
                <View style={styles.payslipLine}>
                  <Text style={styles.payslipLineLabel}>Tracking</Text>
                  <Text style={styles.payslipLineValue}>
                    {selectedSchedule.attendance_tracking_mode.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              )}
              
            </View>
            
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: BRAND.blue, marginTop: 24, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => safeAlert('Navigating', 'Opening Maps...')}>
              <Feather name="navigation" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Navigate to Site</Text>
            </TouchableOpacity>
            
          </View>
        </RNModal>

        {/* TIMESHEETS MODAL */}
        <RNModal isVisible={timesheetModalVisible} onBackdropPress={() => { if(selectedTimeLog) setSelectedTimeLog(null); else setTimesheetModalVisible(false); }} onBackButtonPress={() => { if(selectedTimeLog) setSelectedTimeLog(null); else setTimesheetModalVisible(false); }} onSwipeComplete={() => { if(selectedTimeLog) setSelectedTimeLog(null); else setTimesheetModalVisible(false); }} swipeDirection={selectedTimeLog ? undefined : ['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          {selectedTimeLog ? (
            <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>
              {/* --- DETAILED VIEW: TIMESHEET --- */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={() => setSelectedTimeLog(null)} style={{ padding: 8, marginLeft: -8 }}>
                  <Feather name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Time Log Details</Text>
              </View>
              
              <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 4 }}>
                  {new Date(selectedTimeLog.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: selectedTimeLog.status === 'approved' || selectedTimeLog.status === 'verified' ? '#ECFDF5' : selectedTimeLog.status === 'pending_review' ? '#FFFBEB' : '#FEF2F2' }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: selectedTimeLog.status === 'approved' || selectedTimeLog.status === 'verified' ? BRAND.green : selectedTimeLog.status === 'pending_review' ? BRAND.yellow : BRAND.red }}>
                      {selectedTimeLog.status ? selectedTimeLog.status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: BRAND.blue, marginLeft: 12 }}>
                    {selectedTimeLog.total_hours ? `${selectedTimeLog.total_hours} hrs` : '---'}
                  </Text>
                </View>
                
                <View style={styles.payslipLine}>
                  <Text style={styles.payslipLineLabel}>Time In</Text>
                  <Text style={styles.payslipLineValue}>
                    {selectedTimeLog.app_time_in ? new Date(selectedTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                  </Text>
                </View>
                
                <View style={styles.payslipLine}>
                  <Text style={styles.payslipLineLabel}>Time Out</Text>
                  <Text style={styles.payslipLineValue}>
                    {selectedTimeLog.app_time_out ? new Date(selectedTimeLog.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                  </Text>
                </View>
                
                <View style={styles.payslipDivider} />
                
                <View style={styles.payslipLine}>
                  <Text style={styles.payslipLineLabel}>Geofence Status</Text>
                  <Text style={[styles.payslipLineValue, { color: selectedTimeLog.geofence_status === 'passed' ? BRAND.green : BRAND.yellow }]}>
                    {selectedTimeLog.geofence_status ? selectedTimeLog.geofence_status.toUpperCase() : 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.payslipLine}>
                  <Text style={styles.payslipLineLabel}>Photo Status</Text>
                  <Text style={styles.payslipLineValue}>
                    {selectedTimeLog.photo_status ? selectedTimeLog.photo_status.replace('_', ' ').toUpperCase() : 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.payslipLine}>
                  <Text style={styles.payslipLineLabel}>Manual Entry</Text>
                  <Text style={styles.payslipLineValue}>
                    {selectedTimeLog.is_manual_entry ? 'YES' : 'NO'}
                  </Text>
                </View>
                
                {selectedTimeLog.photo_url && (
                  <View style={{ marginTop: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: '#64748B', marginBottom: 8 }}>Verification Photo</Text>
                    <Image source={{ uri: selectedTimeLog.photo_url }} style={{ width: 120, height: 160, borderRadius: 12, backgroundColor: '#F1F5F9' }} resizeMode="cover" />
                  </View>
                )}
                
              </View>
              
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 24, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => { setTimesheetModalVisible(false); setAiInitialQuery('I would like to dispute my time log for ' + selectedTimeLog.clock_in); setTimeout(() => setSupportModalVisible(true), 500); }}>
                <Feather name="alert-circle" size={20} color={BRAND.red} style={{ marginRight: 8 }} />
                <Text style={[styles.submitBtnText, { color: BRAND.red }]}>Dispute This Entry</Text>
              </TouchableOpacity>
              
            </View>
          ) : (
            <View style={styles.profileOverlay}>
              <View style={[styles.profileSheet, { height: '85%' }]}>
                <View style={styles.sheetHandle} />
                
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>My Timesheets</Text>
                  <TouchableOpacity onPress={() => setTimesheetModalVisible(false)}>
                    <Feather name="x" size={24} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => { setTimesheetModalVisible(false); setAiInitialQuery('I would like to dispute my time log for ' + selectedTimeLog.clock_in); setTimeout(() => setSupportModalVisible(true), 500); }}>
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
                        <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                          No time logs found.
                        </Text>
                      </View>
                    )}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.updateCard}
                        activeOpacity={0.7}
                        onPress={() => setSelectedTimeLog(item)}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.updateTitle}>
                              {new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()}
                            </Text>
                            <Text style={[styles.updateSub, { marginTop: 4 }]}>
                              {item.app_time_in ? new Date(item.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                              {' - '}
                              {item.app_time_out ? new Date(item.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                            </Text>
                            
                            <View style={{ flexDirection: 'row', marginTop: 12 }}>
                              <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 }}>
                                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 11, color: BRAND.blue }}>
                                  {item.total_hours ? `${item.total_hours} hrs` : '---'}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: item.status === 'approved' || item.status === 'verified' ? '#ECFDF5' : item.status === 'pending_review' ? '#FFFBEB' : '#FEF2F2' }}>
                            <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: item.status === 'approved' || item.status === 'verified' ? BRAND.green : item.status === 'pending_review' ? BRAND.yellow : BRAND.red }}>
                              {item.status ? item.status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          )}
        </RNModal>

        {/* LEAVE MODAL */}
        <RNModal isVisible={leaveModalVisible}   onBackdropPress={() => setLeaveModalVisible(false)} onBackButtonPress={() => setLeaveModalVisible(false)} onSwipeComplete={() => setLeaveModalVisible(false)} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '85%' }]}>
              <View style={styles.sheetHandle} />
              
              {createLeaveMode ? (
                <>                  {/* --- CREATE LEAVE VIEW --- */}
                  <View style={styles.modalHeaderRow}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setCreateLeaveMode(false)}>
                      <Feather name="arrow-left" size={20} color="#0F172A" />
                      <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A', marginLeft: 8 }}>Back</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 24, color: '#0F172A', marginBottom: 24 }}>File Leave</Text>
                    
                    <Text style={styles.inputLabel}>Leave Type</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 }}>
                      {['vacation', 'sick', 'emergency', 'unpaid'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8, marginBottom: 8 }, newLeaveType === type && { backgroundColor: BRAND.blue, borderColor: BRAND.blue }]}
                          onPress={() => setNewLeaveType(type)}
                        >
                          <Text style={[{ fontFamily: 'DMSans-Medium', fontSize: 14, color: '#64748B' }, newLeaveType === type && { color: '#fff' }]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Start Date</Text>
                    <TouchableOpacity
                      style={[styles.textInput, { justifyContent: 'center' }]}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Text style={{ fontFamily: 'DMSans-Medium', color: newLeaveStartDate ? '#0F172A' : '#94A3B8' }}>
                        {newLeaveStartDate || 'Select a start date'}
                      </Text>
                    </TouchableOpacity>
                    {showStartDatePicker && (
                      <DateTimePicker value={newLeaveStartDate ? new Date(newLeaveStartDate) : new Date()} minimumDate={new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowStartDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setNewLeaveStartDate(selectedDate.toISOString().split('T')[0]);
                          }
                        }}
                      />
                    )}

                    <Text style={styles.inputLabel}>End Date</Text>
                    <TouchableOpacity
                      style={[styles.textInput, { justifyContent: 'center' }]}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Text style={{ fontFamily: 'DMSans-Medium', color: newLeaveEndDate ? '#0F172A' : '#94A3B8' }}>
                        {newLeaveEndDate || 'Select an end date'}
                      </Text>
                    </TouchableOpacity>
                    {showEndDatePicker && (
                      <DateTimePicker
                        value={newLeaveEndDate ? new Date(newLeaveEndDate) : new Date()}
                        mode="date"
                        display="default"
                        minimumDate={newLeaveStartDate ? new Date(newLeaveStartDate) : undefined}
                        onChange={(event, selectedDate) => {
                          setShowEndDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setNewLeaveEndDate(selectedDate.toISOString().split('T')[0]);
                          }
                        }}
                      />
                    )}

                    <Text style={styles.inputLabel}>Reason</Text>
                    <TextInput
                      style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
                      placeholder="Please explain why you need this leave..."
                      placeholderTextColor="#94A3B8"
                      multiline
                      value={newLeaveReason}
                      onChangeText={setNewLeaveReason} />

                      {newLeaveType === 'sick' && (
                        <View style={{ marginBottom: 16 }}>
                          <Text style={styles.inputLabel}>Medical Certificate (Max 5MB) *</Text>
                          <TouchableOpacity style={[styles.textInput, { justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }]} onPress={async () => { const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true }); if(!res.canceled) setLeaveFile(res.assets[0]); }}>
                            <Feather name='upload-cloud' size={20} color='#94A3B8' style={{ marginRight: 8 }} />
                            <Text style={{ fontFamily: 'DMSans-Medium', color: leaveFile ? '#0F172A' : '#94A3B8' }}>{leaveFile ? leaveFile.name : 'Tap to upload certificate'}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: BRAND.blue }]} onPress={submitLeaveRequest}>
                      <Text style={styles.submitBtnText}>Submit Leave Request</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              ) : (
                <>                  {/* --- LIST VIEW --- */}
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalTitle}>My Leaves</Text>
                    <TouchableOpacity onPress={() => setLeaveModalVisible(false)}>
                      <Feather name="x" size={24} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: BRAND.blue, marginBottom: 16, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => setCreateLeaveMode(true)}>
                    <Feather name="plus" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>File New Leave</Text>
                  </TouchableOpacity>

                  {leaveLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={BRAND.blue} />
                    </View>
                  ) : (
                    <FlatList
                      data={leaveRequests}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                      ListEmptyComponent={() => (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                          <Feather name="sun" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                          <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                            You have no leave requests.
                          </Text>
                        </View>
                      )}
                      renderItem={({ item }) => (
                        <View style={styles.updateCard}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.updateTitle}>{item.leave_type.toUpperCase()} LEAVE</Text>
                              <Text style={styles.updateSub}>{new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}</Text>
                              <Text style={[styles.updateContent, { marginTop: 8 }]} numberOfLines={2}>{item.reason}</Text>
                            </View>
                            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: item.status === 'approved' ? '#ECFDF5' : item.status === 'rejected' ? '#FEF2F2' : '#FFFBEB' }}>
                              <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 10, color: item.status === 'approved' ? BRAND.green : item.status === 'rejected' ? BRAND.red : BRAND.yellow }}>
                                {item.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    />
                  )}
                </>
              )}
            </View>
          </View>
        </RNModal>

        {/* PAYSLIPS MODAL */}
        <RNModal isVisible={payslipsModalVisible} onBackdropPress={() => { if(selectedPayslip) setSelectedPayslip(null); else setPayslipsModalVisible(false); }} onBackButtonPress={() => { if(selectedPayslip) setSelectedPayslip(null); else setPayslipsModalVisible(false); }} onSwipeComplete={() => { if(selectedPayslip) setSelectedPayslip(null); else setPayslipsModalVisible(false); }} swipeDirection={selectedPayslip ? undefined : ['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}>
          {selectedPayslip ? (
            <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>              {/* --- DETAILED VIEW: MODERN BANKING RECEIPT --- */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={() => setSelectedPayslip(null)} style={{ padding: 8, marginLeft: -8 }}>
                  <Feather name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Payslip Details</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                <ViewShot ref={payslipViewRef} options={{ format: 'jpg', quality: 0.9 }} style={{ backgroundColor: '#F8FAFC' }}>
                
                {/* Technocycle Branding */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  <Image source={require('../../../assets/images/technocycle_logo.png')} style={{ width: 36, height: 36, marginRight: 8, resizeMode: 'contain' }} />
                  <View>
                    <Text style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 18, color: '#000', letterSpacing: 0.5 }}>TECHNOCYCLE</Text>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: '#64748B', letterSpacing: 2 }}>CORPORATION</Text>
                  </View>
                </View>

                {/* Hero Header */}
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 12, color: '#64748B', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
                    {selectedPayslip.payroll_period_str || `${new Date(selectedPayslip.period_start).toLocaleDateString('en-US', {month: 'short', day:'numeric'})} to ${new Date(selectedPayslip.period_end).toLocaleDateString('en-US', {month: 'short', day:'numeric', year:'numeric'})}`}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 40, color: '#0F172A' }}>
                    ₱{Number(selectedPayslip.net_pay).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </Text>
                  <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: BRAND.green }}>Net Take-Home Pay</Text>
                  </View>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 11, color: '#94A3B8', marginTop: 12 }}>
                    Period Covered: {new Date(selectedPayslip.period_start).toLocaleDateString('en-US', {month: 'long', day:'numeric'})} to {new Date(selectedPayslip.period_end).toLocaleDateString('en-US', {month: 'long', day:'numeric', year:'numeric'})}
                  </Text>
                </View>

                {/* Earnings Card */}
                <View style={styles.payslipSectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Feather name="arrow-down-left" size={16} color={BRAND.blue} />
                    </View>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A' }}>Earnings</Text>
                  </View>
                  
                  <View style={styles.payslipLine}>
                    <Text style={styles.payslipLineLabel}>Basic Salary ({selectedPayslip.days_worked} days)</Text>
                    <Text style={styles.payslipLineValue}>₱{Number(selectedPayslip.basic_salary).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  </View>
                  {selectedPayslip.regular_holiday_pay > 0 && (
                    <View style={styles.payslipLine}>
                      <Text style={styles.payslipLineLabel}>Regular Holiday</Text>
                      <Text style={styles.payslipLineValue}>₱{Number(selectedPayslip.regular_holiday_pay).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </View>
                  )}
                  {selectedPayslip.special_holiday_pay > 0 && (
                    <View style={styles.payslipLine}>
                      <Text style={styles.payslipLineLabel}>Special Non-Working</Text>
                      <Text style={styles.payslipLineValue}>₱{Number(selectedPayslip.special_holiday_pay).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </View>
                  )}
                  {selectedPayslip.vacation_leave_pay > 0 && (
                    <View style={styles.payslipLine}>
                      <Text style={styles.payslipLineLabel}>Vacation Leave</Text>
                      <Text style={styles.payslipLineValue}>₱{Number(selectedPayslip.vacation_leave_pay).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </View>
                  )}
                  
                  <View style={styles.payslipDivider} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#0F172A' }}>Gross Pay</Text>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#0F172A' }}>₱{Number(selectedPayslip.gross_pay).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  </View>
                </View>

                {/* Deductions Card */}
                <View style={styles.payslipSectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Feather name="arrow-up-right" size={16} color={BRAND.red} />
                    </View>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A' }}>Deductions</Text>
                  </View>

                  <View style={styles.payslipLine}>
                    <Text style={styles.payslipLineLabel}>SSS Contribution</Text>
                    <Text style={styles.payslipLineValue}>-₱{Number(selectedPayslip.sss_deduction).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  </View>
                  <View style={styles.payslipLine}>
                    <Text style={styles.payslipLineLabel}>PhilHealth</Text>
                    <Text style={styles.payslipLineValue}>-₱{Number(selectedPayslip.philhealth_deduction).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  </View>
                  <View style={styles.payslipLine}>
                    <Text style={styles.payslipLineLabel}>Pag-IBIG (HDMF)</Text>
                    <Text style={styles.payslipLineValue}>-₱{Number(selectedPayslip.pagibig_deduction).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  </View>
                  
                  <View style={styles.payslipDivider} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#0F172A' }}>Total Deductions</Text>
                    <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: BRAND.red }}>-₱{Number(selectedPayslip.total_deductions).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  </View>
                </View>

                </ViewShot>

                {/* Footer */}
                <View style={{ marginTop: 24, alignItems: 'center', paddingHorizontal: 24 }}>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 }}>
                    I acknowledge receiving the amount stated above and have no further claims for services rendered to TECHNOCYCLE CORPORATION.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.submitBtn, { backgroundColor: BRAND.blue, marginTop: 32, width: '100%' }]}
                    onPress={downloadPayslip}
                  >
                    <Text style={[styles.submitBtnText, { color: '#FFF' }]}>Download Payslip</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.submitBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 16, width: '100%' }]}
                    onPress={() => {
                      setPayslipsModalVisible(false);
                      setTimeout(() => setSupportModalVisible(true), 500);
                    }}
                  >
                    <Text style={[styles.submitBtnText, { color: BRAND.red }]}>Dispute Payslip</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={styles.profileOverlay}>
              <View style={[styles.profileSheet, { height: '85%' }]}>
                <View style={styles.sheetHandle} />
                <>
                  {/* --- LIST VIEW --- */}
                  <View style={styles.modalHeaderRow}>
                    <Text style={styles.modalTitle}>My Payslips</Text>
                    <TouchableOpacity onPress={() => { setPayslipsModalVisible(false); setSelectedPayslip(null); }}>
                      <Feather name="x" size={24} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {payslipsLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={BRAND.green} />
                    </View>
                  ) : (
                    <FlatList
                      data={payslips}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                      ListEmptyComponent={() => (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                          <Feather name="dollar-sign" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                          <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                            No payslips available.
                          </Text>
                        </View>
                      )}
                      renderItem={({ item }) => {
                        const net = Number(item.net_pay || 0);
                        const formatMoney = (val: number) => '₱' + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        
                        return (
                          <TouchableOpacity 
                            style={styles.payslipCard}
                            activeOpacity={0.8}
                            onPress={() => setSelectedPayslip(item)}
                          >
                            <View style={styles.payslipHeader}>
                              <View>
                                <Text style={styles.payslipPeriodTitle}>PAYROLL</Text>
                                <Text style={styles.payslipPeriod}>{item.payroll_period_str || new Date(item.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' to ' + new Date(item.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                              </View>
                              <View style={styles.payslipNetBox}>
                                <Text style={styles.payslipNetLabel}>Net Pay</Text>
                                <Text style={styles.payslipNetValue}>{formatMoney(net)}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )}
                </>
              </View>
            </View>
          )}
        </RNModal>

      </SafeAreaView>
    </View>
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: colors.text, letterSpacing: -0.5 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.red },
  mainContent: { paddingHorizontal: 24, flex: 1, paddingTop: 8 },
  clockInCard: { backgroundColor: colors.card, borderRadius: 28, padding: 24, flexDirection: 'row', alignItems: 'center', shadowColor: isDark ? '#000' : BRAND.blue, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 8, marginBottom: 40, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  clockInIconContainer: { width: 64, height: 64, borderRadius: 20, backgroundColor: isDark ? colors.subCard : '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  clockInTextContainer: { flex: 1 },
  clockInTitle: { fontFamily: 'DMSans-Bold', fontSize: 22, color: colors.text, marginBottom: 4 },
  clockInSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted },
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
  fallbackSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  mapContainer: { height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: isDark ? colors.subCard : '#F1F5F9', marginBottom: 24 },
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
  payslipCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? colors.cardBorder : '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  payslipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payslipPeriodTitle: { fontFamily: 'DMSans-Bold', fontSize: 10, color: colors.textSubtle, letterSpacing: 1, marginBottom: 4 },
  payslipPeriod: { fontFamily: 'DMSans-Bold', fontSize: 14, color: colors.text },
  payslipNetBox: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'flex-end' },
  payslipNetLabel: { fontFamily: 'DMSans-Medium', fontSize: 10, color: BRAND.green, marginBottom: 2 },
  payslipNetValue: { fontFamily: 'DMSans-Bold', fontSize: 16, color: BRAND.green },
  payslipDetails: { marginTop: 16 },
  payslipDivider: { height: 1, backgroundColor: isDark ? colors.border : '#F1F5F9', marginBottom: 16 },
  payslipRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payslipCol: { flex: 1, paddingRight: 8 },
  payslipSectionTitle: { fontFamily: 'DMSans-Bold', fontSize: 12, color: colors.text, marginBottom: 12 },
  payslipLineItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  payslipLineLabel: { fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted },
  payslipLineValue: { fontFamily: 'DMSans-Medium', fontSize: 12, color: colors.text },
  payslipFooter: { marginTop: 16, alignItems: 'center' },
  payslipFooterText: { fontFamily: 'DMSans-Medium', fontSize: 10, color: colors.textSubtle },
  payslipSectionCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder },
  payslipLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
});

















