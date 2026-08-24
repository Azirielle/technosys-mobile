import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, Animated, Easing, ActivityIndicator, ScrollView, Image, Alert, Platform, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getDistance } from 'geolib';
import MapView, { Marker, Circle } from '../../components/MapWrapper';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width, height } = Dimensions.get('window');

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
    language: "言語",
    settings: "設定",
    equipment: "機材",
    support: "サポート",
    updates: "更新",
  }
};
export default function HomeScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<'en' | 'tl' | 'ja'>('en');
  const [darkMode, setDarkMode] = useState(false);
  
  const t = (key: string) => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en'][key] || key;
  };
  const activeFont = language === 'ja' ? 'System' : 'DMSans-Medium';
  const activeFontBold = language === 'ja' ? 'System' : 'DMSans-Bold';
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [clockInModal, setClockInModal] = useState(false);
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
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [dtrLogs, setDtrLogs] = useState<any[]>([]);
  const [dtrLoading, setDtrLoading] = useState(false);

  // Chunk 14: Notifications
  const [notifVisible, setNotifVisible] = useState(false);
  const notifAnim = useRef(new Animated.Value(width)).current;
  const [dispatchVisible, setDispatchVisible] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: 1, type: 'dispatch', title: 'New Direct Dispatch', desc: 'Assigned to Makati HQ for Maintenance.', time: '10m ago', read: false },
    { id: 2, type: 'hr', title: 'Photo Override Approved', desc: 'Your clock-in at 8:05 AM was verified by HR.', time: '1h ago', read: false },
    { id: 3, type: 'tool', title: 'Tool Checkout', desc: 'Heavy Drill #442 assigned to you.', time: '2h ago', read: true },
    { id: 4, type: 'admin', title: 'Payslip Available', desc: 'Your payslip for Aug 15 is now ready for viewing.', time: '1d ago', read: true },
    { id: 5, type: 'help', title: 'Ticket Updated', desc: 'IT Support replied to Ticket #1042.', time: '2d ago', read: true },
  ]);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

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
        .select(
          'id, quantity, borrowed_at, returned_at, status, notes, tool_catalog ( id, name, image_url )'
        )
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

  // File Leave Feature
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [createLeaveMode, setCreateLeaveMode] = useState(false);
  const [newLeaveType, setNewLeaveType] = useState('vacation');
  const [newLeaveStartDate, setNewLeaveStartDate] = useState('');
  const [newLeaveEndDate, setNewLeaveEndDate] = useState('');
  const [newLeaveReason, setNewLeaveReason] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Timesheets Feature
  const [timesheetModalVisible, setTimesheetModalVisible] = useState(false);
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
        router.replace('/');
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
    }
    loadData();
  }, []);

  const openMenu = () => {
    setMenuVisible(true);
    Animated.timing(menuAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }).start();
  };

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
      } catch (err) {
        console.error(err);
        Alert.alert('Upload Failed', 'There was an issue uploading your photo.');
      }
      setUploadingSelfie(false);
    }
  };

  return (
    <View style={styles.masterContainer}>
      <LinearGradient colors={['#FFFFFF', '#F8FAFC', '#E2E8F0']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtnOutline} onPress={() => setProfileModalVisible(true)}>
            <Feather name="user" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Image source={require('../../../assets/logo.png')} style={{ width: 45, height: 45, resizeMode: 'contain' }} />
            <Text style={styles.headerTitle}>{profile ? profile.full_name : 'TechnoSys'}</Text>
          </View>
          <TouchableOpacity style={styles.headerBtnOutline} onPress={() => setNotifVisible(true)}>
            <Feather name="bell" size={24} color="#0F172A" />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>
          <TouchableOpacity style={styles.clockInCard} activeOpacity={0.8} onPress={handleClockIn}>
            <View style={styles.clockInIconContainer}>
              <Ionicons name="scan-outline" size={32} color={BRAND.blue} />
            </View>
            <View style={styles.clockInTextContainer}>
              <Text style={styles.clockInTitle}>Clock In</Text>
              <Text style={styles.clockInSub}>Tap to verify location presence</Text>
            </View>
            <Feather name="arrow-right" size={24} color={BRAND.blue} />
          </TouchableOpacity>

          <View style={styles.bubbleRow}>
            <TouchableOpacity style={styles.bubbleBtn} onPress={() => { fetchEquipment(); setEquipModalVisible(true); }}>
              <View style={[styles.bubbleCircle, { shadowColor: BRAND.yellow }]}>
                <Feather name="tool" size={24} color={BRAND.yellow} />
              </View>
              <Text style={styles.bubbleText}>Equipment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bubbleBtn} onPress={() => { fetchTickets(); setSupportModalVisible(true); }}>
              <View style={[styles.bubbleCircle, { shadowColor: BRAND.green }]}>
                <Feather name="headphones" size={24} color={BRAND.green} />
              </View>
              <Text style={styles.bubbleText}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bubbleBtn} onPress={() => { fetchAnnouncements(); setUpdatesModalVisible(true); }}>
              <View style={[styles.bubbleCircle, { shadowColor: BRAND.red }]}>
                <Feather name="radio" size={24} color={BRAND.red} />
              </View>
              <Text style={styles.bubbleText}>Updates</Text>
            </TouchableOpacity>
          </View>

          {schedule ? (
            <TouchableOpacity style={styles.dispatchWidget} activeOpacity={0.8} onPress={() => setDispatchVisible(true)}>
              <View style={styles.dispatchHeader}>
                <View style={styles.dispatchIconContainer}>
                  <Feather name="navigation" size={16} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dispatchWidgetTitle, { fontFamily: activeFontBold }]}>{t('priority_dispatch')}</Text>
                  <Text style={[styles.dispatchWidgetSub, { fontFamily: activeFont }]}>{t('active_ticket')}</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#3B82F6" />
              </View>
              <View style={styles.dispatchBody}>
                <Text style={styles.dispatchDestination} numberOfLines={2}>
                  {schedule.location}
                </Text>
                <Text style={styles.dispatchClient}>{schedule.client_name}</Text>
              </View>
              <View style={styles.dispatchAction}>
                <Text style={[styles.dispatchActionText, { fontFamily: activeFontBold }]}>{t('view_dispatch_details')}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.infoCard}>
              <Text style={[styles.infoTitle, { fontFamily: activeFontBold }]}>{t('priority_dispatch')}</Text>
              <Text style={[styles.infoSub, { fontFamily: activeFont }]}>{t('no_active_deployments')}</Text>
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
        <Modal visible={menuVisible} transparent={true} animationType="none">
          <Animated.View style={[styles.menuOverlay, { opacity: menuAnim }]}>
            <Animated.View style={[styles.menuContent, { transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]}>
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
                    <MenuGridItem icon="sun" label={t('file_leave')} fontFamily={activeFontBold} color={BRAND.red} onPress={() => { fetchLeaveRequests(); setLeaveModalVisible(true); }} />
                    <MenuGridItem icon="clock" label={t('timesheets')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { fetchTimeLogs(); setTimesheetModalVisible(true); }} />
                  </View>
                  <Text style={[styles.categoryTitle, { fontFamily: activeFontBold }]}>Company & Support</Text>
                  <View style={styles.menuGrid}>
                    <MenuGridItem icon="bell" label={t('announcements')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { fetchAnnouncements(); setUpdatesModalVisible(true); }} />
                    <MenuGridItem icon="help-circle" label={t('support')} fontFamily={activeFontBold} color={BRAND.red} onPress={() => { fetchTickets(); setSupportModalVisible(true); }} />
                    <MenuGridItem icon="settings" label={t('preferences')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { setMenuVisible(false); setPreferencesModalVisible(true); }} />
                    <MenuGridItem icon="user" label={t('settings')} fontFamily={activeFontBold} color={BRAND.blue} onPress={() => { setMenuVisible(false); setProfileModalVisible(true); }} />
                  </View>
                  <View style={{height: 120}} />
                </ScrollView>
                <View style={styles.bottomCloseContainer}>
                   <TouchableOpacity style={styles.flowerCloseBtn} onPress={closeMenu} activeOpacity={0.8}>
                      <View style={styles.flowerRing1}><View style={styles.flowerRing2}><Text style={styles.flowerText}>Tap to{"\n"}close</Text></View></View>
                   </TouchableOpacity>
                </View>
              </SafeAreaView>
            </Animated.View>
          </Animated.View>
        </Modal>

        {/* VERIFICATION MODAL */}
        <Modal visible={clockInModal} transparent={true} animationType="fade">
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
                      <MapView style={styles.map} initialRegion={{ latitude: userLoc.lat, longitude: userLoc.lon, latitudeDelta: 0.005, longitudeDelta: 0.005 }}>
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
        </Modal>

        {/* PROFILE MODAL (Bottom Sheet) */}
        <Modal visible={profileModalVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={styles.profileSheet}>
              {/* Handle */}
              <View style={styles.sheetHandle} />
              
              {/* Header: Name, Role, Status */}
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                  <Feather name="user" size={32} color={BRAND.blue} />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{profile ? profile.full_name : 'TechnoSys'}</Text>
                  <Text style={styles.profileRole}>{profile ? profile.role.toUpperCase() : 'TECHNICIAN'}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Online</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeProfileBtn} onPress={() => setProfileModalVisible(false)}>
                <Feather name="x" size={24} color="#64748B" />
              </TouchableOpacity>

              {/* Menu Items */}
              <View style={styles.profileMenu}>
                <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setProfileModalVisible(false); fetchTimeLogs(); setTimesheetModalVisible(true); }}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: '#E0F2FE' }]}>
                    <Feather name="clock" size={20} color="#0EA5E9" />
                  </View>
                  <Text style={styles.profileMenuText}>My DTR</Text>
                  <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setFormsModalVisible(true); }}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Feather name="file-text" size={20} color="#F59E0B" />
                  </View>
                  <Text style={styles.profileMenuText}>Company Forms and handbooks</Text>
                  <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.profileMenuItem} onPress={() => { setLangModalVisible(true); }}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: '#F1F5F9' }]}>
                    <Feather name="globe" size={20} color="#64748B" />
                  </View>
                  <Text style={styles.profileMenuText}>Preferences (Language)</Text>
                  <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.profileMenuItem} onPress={() => safeAlert('Coming Soon', 'Dark Mode will be available in v2.0!')}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: '#F1F5F9' }]}>
                    <Feather name="moon" size={20} color="#64748B" />
                  </View>
                  <Text style={styles.profileMenuText}>Dark Mode</Text>
                  <Feather name="chevron-right" size={20} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.profileMenuItem, { borderBottomWidth: 0, marginTop: 16 }]} onPress={() => setLogoutModalVisible(true)}>
                  <View style={[styles.profileMenuIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Feather name="log-out" size={20} color="#EF4444" />
                  </View>
                  <Text style={[styles.profileMenuText, { color: '#EF4444' }]}>Log Out</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>

        {/* DTR MODAL */}
        <Modal visible={dtrModalVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>My DTR</Text>
                <TouchableOpacity onPress={() => setDtrModalVisible(false)}><Feather name="x" size={24} color="#64748B" /></TouchableOpacity>
              </View>
              {dtrLoading ? (
                <ActivityIndicator size="large" color={BRAND.blue} style={{ marginTop: 40 }} />
              ) : (
                <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
                  {dtrLogs.map((log, idx) => (
                    <View key={idx} style={styles.dtrRow}>
                      <View>
                        <Text style={styles.dtrDate}>{new Date(log.app_time_in).toLocaleDateString()}</Text>
                        <Text style={styles.dtrTime}>{new Date(log.app_time_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: log.status === 'verified' ? '#ECFDF5' : '#FEF3C7' }]}>
                        <Text style={[styles.statusText, { color: log.status === 'verified' ? BRAND.green : BRAND.yellow }]}>{log.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  ))}
                  {dtrLogs.length === 0 && <Text style={{ textAlign: 'center', color: '#64748B', marginTop: 40 }}>No logs found.</Text>}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* FORMS MODAL */}
        <Modal visible={formsModalVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '60%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Company Forms</Text>
                <TouchableOpacity onPress={() => setFormsModalVisible(false)}><Feather name="x" size={24} color="#64748B" /></TouchableOpacity>
              </View>
              <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
                {['Employee Code of Conduct', 'Leave Policy', 'Equipment Handling Manual'].map((form, idx) => (
                  <TouchableOpacity key={idx} style={styles.profileMenuItem} onPress={() => safeAlert('Coming Soon', 'This document is not yet available.')}>
                    <View style={[styles.profileMenuIcon, { backgroundColor: '#F1F5F9' }]}><Feather name="file" size={20} color="#64748B" /></View>
                    <Text style={styles.profileMenuText}>{form}</Text>
                    <Feather name="download" size={20} color={BRAND.blue} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* LANGUAGE MODAL */}
        <Modal visible={langModalVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '50%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Preferences (Language)</Text>
                <TouchableOpacity onPress={() => setLangModalVisible(false)}><Feather name="x" size={24} color="#64748B" /></TouchableOpacity>
              </View>
              <View style={{ marginTop: 16 }}>
                {[ { label: 'English', code: 'en' }, { label: 'Filipino (Tagalog)', code: 'fil' }, { label: 'Japanese', code: 'ja' } ].map((lang, idx) => (
                  <TouchableOpacity key={idx} style={styles.profileMenuItem} onPress={() => { safeAlert('Success', `${lang.label} language selected.`); setLangModalVisible(false); }}>
                    <Text style={styles.profileMenuText}>{lang.label}</Text>
                    {lang.code === 'en' && <Feather name="check" size={20} color={BRAND.green} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* PREFERENCES MODAL */}
        <Modal visible={preferencesModalVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: 400 }]}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitle, { fontFamily: activeFontBold }]}>{t('preferences')}</Text>
                <TouchableOpacity onPress={() => setPreferencesModalVisible(false)}>
                  <Feather name="x" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
                <Text style={[{ fontSize: 14, color: '#64748B', marginBottom: 12, textTransform: 'uppercase' }, { fontFamily: activeFontBold }]}>{t('language')}</Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: language === 'en' ? BRAND.blue : '#E2E8F0', backgroundColor: language === 'en' ? '#EFF6FF' : '#fff', marginRight: 8, alignItems: 'center' }}
                    onPress={() => setLanguage('en')}
                  >
                    <Text style={{ fontFamily: 'DMSans-Bold', color: language === 'en' ? BRAND.blue : '#0F172A' }}>EN</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: language === 'tl' ? BRAND.blue : '#E2E8F0', backgroundColor: language === 'tl' ? '#EFF6FF' : '#fff', marginRight: 8, alignItems: 'center' }}
                    onPress={() => setLanguage('tl')}
                  >
                    <Text style={{ fontFamily: 'DMSans-Bold', color: language === 'tl' ? BRAND.blue : '#0F172A' }}>TL</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: language === 'ja' ? BRAND.blue : '#E2E8F0', backgroundColor: language === 'ja' ? '#EFF6FF' : '#fff', alignItems: 'center' }}
                    onPress={() => setLanguage('ja')}
                  >
                    <Text style={{ fontFamily: 'System', fontWeight: 'bold', color: language === 'ja' ? BRAND.blue : '#0F172A' }}>JA</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[{ fontSize: 14, color: '#64748B', marginBottom: 12, textTransform: 'uppercase' }, { fontFamily: activeFontBold }]}>{t('dark_mode')}</Text>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}
                  onPress={() => safeAlert('Coming Soon', 'Dark mode theme is under development.')}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                    <Feather name={darkMode ? "moon" : "sun"} size={20} color="#475569" />
                  </View>
                  <Text style={[{ fontSize: 16, color: '#0F172A', flex: 1 }, { fontFamily: activeFontBold }]}>{darkMode ? "On" : "Off"}</Text>
                  <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: '#CBD5E1', justifyContent: 'center', paddingHorizontal: 2 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
                  </View>
                </TouchableOpacity>
                
              </View>
            </View>
          </View>
        </Modal>

        {/* LOGOUT CONFIRMATION MODAL */}
        <Modal visible={logoutModalVisible} transparent={true} animationType="fade">
          <View style={styles.verificationOverlay}>
            <View style={[styles.verificationCard, { padding: 32, alignItems: 'center' }]}>
              <View style={[styles.gridIconCircle, { backgroundColor: '#FEE2E2', width: 64, height: 64, borderRadius: 32, marginBottom: 16 }]}>
                <Feather name="log-out" size={32} color="#EF4444" />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Log Out</Text>
              <Text style={[styles.fallbackSub, { textAlign: 'center' }]}>Are you sure you want to log out of your account?</Text>
              
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, width: '100%' }}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' }} onPress={() => setLogoutModalVisible(false)}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#64748B' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }} onPress={handleLogout}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#FFFFFF' }}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* NOTIFICATION DRAWER */}
        {/* NOTIFICATION DRAWER */}
        <Modal visible={notifVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '80%' }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Notifications</Text>
                <TouchableOpacity onPress={() => setNotifVisible(false)}>
                  <Feather name="x" size={24} color="#64748B" />
                </TouchableOpacity>
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => {
                  setNotifications(notifications.map(n => ({ ...n, read: true })));
                }}>
                  <Text style={styles.notifMarkRead}>Mark all read</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: notif }) => {
                  let icon = 'bell';
                  let color = '#64748B';
                  let bgColor = '#F1F5F9';
                  if (notif.type === 'dispatch') { icon = 'navigation'; color = '#EF4444'; bgColor = '#FEE2E2'; }
                  if (notif.type === 'hr') { icon = 'check-circle'; color = '#10B981'; bgColor = '#D1FAE5'; }
                  if (notif.type === 'tool') { icon = 'tool'; color = '#F59E0B'; bgColor = '#FEF3C7'; }
                  if (notif.type === 'admin') { icon = 'file-text'; color = '#3B82F6'; bgColor = '#DBEAFE'; }
                  if (notif.type === 'help') { icon = 'life-buoy'; color = '#8B5CF6'; bgColor = '#EDE9FE'; }

                  return (
                    <TouchableOpacity 
                      style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                      onPress={() => {
                        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
                        setSelectedNotif(notif);
                      }}
                    >
                      <View style={[styles.notifIconCircle, { backgroundColor: bgColor }]}>
                        <Feather name={icon as any} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifItemTitle}>{notif.title}</Text>
                        <Text style={styles.notifItemDesc}>{notif.desc}</Text>
                        <Text style={styles.notifItemTime}>{notif.time}</Text>
                      </View>
                      {!notif.read && <View style={styles.notifUnreadDot} />}
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={() => (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                      Showing latest notifications. Older alerts are automatically archived in their respective modules.
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* PRIORITY DISPATCH MODAL */}
        <Modal visible={dispatchVisible} transparent={true} animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setDispatchVisible(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color="#0F172A" />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Dispatch Details</Text>
            </View>
            
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={[styles.notifIconCircle, { backgroundColor: '#DBEAFE', marginRight: 16 }]}>
                  <Feather name="navigation" size={24} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 14, color: '#3B82F6', letterSpacing: 1, marginBottom: 4 }}>
                    ACTIVE TICKET
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: '#94A3B8' }}>
                    Assigned 10m ago
                  </Text>
                </View>
              </View>
              
              <View style={styles.payslipDivider} />
              
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 8, marginTop: 8 }}>
                {schedule?.client_name || 'N/A'}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                <Feather name="map-pin" size={16} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: '#475569', lineHeight: 22, flex: 1 }}>
                  {schedule?.location || 'N/A'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 }}>
                <Feather name="info" size={16} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 15, color: '#475569', lineHeight: 22, flex: 1 }}>
                  {schedule?.remarks || 'Perform standard maintenance checks on network rack cooling systems.'}
                </Text>
              </View>

              <View style={styles.payslipDivider} />

              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginRight: 12 }]} onPress={() => setDispatchVisible(false)}>
                  <Text style={[styles.submitBtnText, { color: '#64748B' }]}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, { flex: 2, backgroundColor: '#3B82F6' }]} onPress={() => {
                  safeAlert('Navigating', 'Opening GPS mapping system...');
                  setDispatchVisible(false);
                }}>
                  <Text style={styles.submitBtnText}>Acknowledge & Go</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* NOTIFICATION DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <Modal visible={!!selectedNotif} transparent={true} animationType="slide">
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
        </Modal>

        {/* EQUIPMENT MODAL */}
        <Modal visible={equipModalVisible} transparent={true} animationType="slide">
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
        </Modal>

        {/* SUPPORT MODAL */}
        <Modal visible={supportModalVisible} transparent={true} animationType="slide">
          <View style={styles.profileOverlay}>
            <View style={[styles.profileSheet, { height: '90%' }]}>
              <View style={styles.sheetHandle} />
              
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>{createTicketMode ? 'New Ticket' : 'Help & Support'}</Text>
                <TouchableOpacity onPress={() => {
                  if (createTicketMode) {
                    setCreateTicketMode(false);
                  } else {
                    setSupportModalVisible(false);
                  }
                }}>
                  <Feather name={createTicketMode ? "arrow-left" : "x"} size={24} color="#64748B" />
                </TouchableOpacity>
              </View>

              {createTicketMode ? (
                /* CREATE TICKET MODE */
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput 
                    style={styles.inputField}
                    placeholder="Briefly describe the issue..."
                    placeholderTextColor="#94A3B8"
                    value={ticketForm.title}
                    onChangeText={(text) => setTicketForm({...ticketForm, title: text})}
                  />
                  
                  <Text style={styles.inputLabel}>Category</Text>
                  <View style={styles.categoryPills}>
                    {TICKET_CATEGORIES.map(cat => (
                      <TouchableOpacity 
                        key={cat}
                        style={[styles.categoryPill, ticketForm.category === cat && styles.categoryPillActive]}
                        onPress={() => setTicketForm({...ticketForm, category: cat})}
                      >
                        <Text style={[styles.categoryPillText, ticketForm.category === cat && styles.categoryPillTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput 
                    style={[styles.inputField, { height: 120, textAlignVertical: 'top' }]}
                    placeholder="Provide detailed information..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={ticketForm.description}
                    onChangeText={(text) => setTicketForm({...ticketForm, description: text})}
                  />

                  <TouchableOpacity 
                    style={[styles.submitBtn, isSubmittingTicket && { opacity: 0.7 }]}
                    onPress={submitTicket}
                    disabled={isSubmittingTicket}
                  >
                    {isSubmittingTicket ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Ticket</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                /* LIST TICKETS MODE */
                <>
                  <TouchableOpacity style={styles.newTicketBtn} onPress={() => setCreateTicketMode(true)}>
                    <Feather name="plus" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.newTicketBtnText}>Create New Ticket</Text>
                  </TouchableOpacity>

                  {ticketsLoading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={BRAND.blue} />
                    </View>
                  ) : (
                    <FlatList
                      data={tickets}
                      keyExtractor={(item) => item.id}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
                      ListEmptyComponent={() => (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                          <Feather name="check-circle" size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                          <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', textAlign: 'center' }}>
                            You have no open support tickets!
                          </Text>
                        </View>
                      )}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.ticketItem} onPress={() => setSelectedTicket(item)} activeOpacity={0.7}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ticketTitle}>{item.title}</Text>
                            <Text style={styles.ticketSub}>{item.category} • {new Date(item.created_at).toLocaleDateString()}</Text>
                          </View>
                          <View style={[styles.ticketBadge, item.status === 'open' ? styles.badgeOpen : styles.badgeResolved]}>
                            <Text style={[styles.ticketBadgeText, item.status === 'open' ? styles.badgeTextOpen : styles.badgeTextResolved]}>
                              {item.status.toUpperCase()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* SUPPORT TICKET DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <Modal visible={!!selectedTicket} transparent={true} animationType="slide">
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
        </Modal>

        {/* UPDATES MODAL */}
        <Modal visible={updatesModalVisible} transparent={true} animationType="slide">
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
                    <TouchableOpacity 
                      style={styles.updateItem}
                      activeOpacity={0.7}
                      onPress={() => setSelectedUpdate(item)}
                    >
                      <View style={styles.updateIconWrap}>
                        <Feather name="radio" size={20} color={BRAND.blue} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.updateTitle}>{item.title}</Text>
                        <Text style={styles.updateSub}>
                          {item.profiles?.full_name || 'Admin'} • {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                        <Text style={styles.updateContent} numberOfLines={2}>
                          {item.content}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* UPDATES DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <Modal visible={!!selectedUpdate} transparent={true} animationType="slide">
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>
            {/* --- DETAILED VIEW: UPDATE --- */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity onPress={() => setSelectedUpdate(null)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color="#0F172A" />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Announcement</Text>
            </View>
            
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', flex: 1, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={[styles.updateIconWrap, { backgroundColor: '#EFF6FF', marginRight: 16 }]}>
                  <Feather name="radio" size={24} color={BRAND.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 4 }}>
                    {selectedUpdate?.title}
                  </Text>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 13, color: '#64748B' }}>
                    {selectedUpdate?.profiles?.full_name || 'Admin'} • {selectedUpdate?.created_at ? new Date(selectedUpdate.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              </View>
              
              <View style={styles.payslipDivider} />
              
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 16, color: '#334155', lineHeight: 24 }}>
                  {selectedUpdate?.content}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* WORK ORDERS MODAL */}
        <Modal visible={workOrdersModalVisible} transparent={true} animationType="slide">
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
        </Modal>

        {/* SCHEDULES MODAL (LIST VIEW) */}
        <Modal visible={schedulesModalVisible} transparent={true} animationType="slide">
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
        </Modal>

        {/* SCHEDULES DETAILS MODAL (SEPARATED FOR ANIMATION) */}
        <Modal visible={!!selectedSchedule} transparent={true} animationType="slide">
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
        </Modal>

        {/* TIMESHEETS MODAL */}
        <Modal visible={timesheetModalVisible} transparent={true} animationType="slide">
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
              
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 24, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => safeAlert('Dispute Logged', 'HR has been notified to review your timesheets.')}>
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

                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, flexDirection: 'row', justifyContent: 'center' }]} onPress={() => safeAlert('Dispute Logged', 'HR has been notified to review your timesheets.')}>
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
        </Modal>

        {/* LEAVE MODAL */}
        <Modal visible={leaveModalVisible} transparent={true} animationType="slide">
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
                      <DateTimePicker
                        value={newLeaveStartDate ? new Date(newLeaveStartDate) : new Date()}
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
                      onChangeText={setNewLeaveReason}
                    />

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
        </Modal>

        {/* PAYSLIPS MODAL */}
        <Modal visible={payslipsModalVisible} transparent={true} animationType="slide">
          {selectedPayslip ? (
            <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: 60, paddingHorizontal: 24 }}>              {/* --- DETAILED VIEW: MODERN BANKING RECEIPT --- */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                <TouchableOpacity onPress={() => setSelectedPayslip(null)} style={{ padding: 8, marginLeft: -8 }}>
                  <Feather name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginLeft: 8 }}>Payslip Details</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                
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

                {/* Footer */}
                <View style={{ marginTop: 24, alignItems: 'center', paddingHorizontal: 24 }}>
                  <Text style={{ fontFamily: 'DMSans-Medium', fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 }}>
                    I acknowledge receiving the amount stated above and have no further claims for services rendered to TECHNOCYCLE CORPORATION.
                  </Text>
                  
                  <TouchableOpacity 
                    style={[styles.submitBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 32, width: '100%' }]}
                    onPress={() => safeAlert('Dispute Logged', 'HR has been notified of your payslip dispute.')}
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
                <>                  {/* --- LIST VIEW --- */}
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
        </Modal>

      </SafeAreaView>
    </View>
  );
}

const MenuGridItem = ({ icon, label, color, onPress, fontFamily }: { icon: any, label: string, color: string, onPress?: () => void, fontFamily?: string }) => (
  <TouchableOpacity style={styles.gridItem} onPress={onPress}>
    <View style={styles.gridIconCircle}>
      <Feather name={icon} size={24} color={color} />
    </View>
    <Text style={[styles.gridItemText, fontFamily ? { fontFamily } : {}]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  masterContainer: { flex: 1, backgroundColor: BRAND.lightBg },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  headerBtnOutline: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', letterSpacing: -0.5 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.red },
  mainContent: { paddingHorizontal: 24, flex: 1, paddingTop: 8 },
  clockInCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, flexDirection: 'row', alignItems: 'center', shadowColor: BRAND.blue, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 8, marginBottom: 40 },
  clockInIconContainer: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  clockInTextContainer: { flex: 1 },
  clockInTitle: { fontFamily: 'DMSans-Bold', fontSize: 22, color: '#0F172A', marginBottom: 4 },
  clockInSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#64748B' },
  bubbleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 40 },
  bubbleBtn: { alignItems: 'center', gap: 12 },
  bubbleCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  bubbleText: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#1D2D44' },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, shadowColor: '#C0C2C9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 5 },
  dispatchWidget: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#DBEAFE', overflow: 'hidden', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8, marginTop: 12 },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#DBEAFE' },
  dispatchIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  dispatchWidgetTitle: { fontFamily: 'DMSans-Bold', fontSize: 13, color: '#1E3A8A', letterSpacing: 1 },
  dispatchWidgetSub: { fontFamily: 'DMSans-Medium', fontSize: 11, color: '#3B82F6' },
  dispatchBody: { padding: 20 },
  dispatchDestination: { fontFamily: 'DMSans-Bold', fontSize: 18, color: '#0F172A', marginBottom: 8 },
  dispatchClient: { fontFamily: 'DMSans-Medium', fontSize: 14, color: '#64748B' },
  dispatchAction: { backgroundColor: '#3B82F6', padding: 16, alignItems: 'center' },
  dispatchActionText: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#FFFFFF' },
  infoTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A', marginBottom: 6 },
  infoSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#64748B', lineHeight: 20 },
  floatingMenuContainer: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  menuPill: { backgroundColor: BRAND.blue, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 32, shadowColor: BRAND.yellow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  menuPillText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: BRAND.yellow },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)' },
  menuContent: { flex: 1 },
  menuHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  menuHeaderText: { fontFamily: 'DMSans-Bold', fontSize: 20, color: '#fff' },
  closeBtnTop: { padding: 8 },
  menuScroll: { paddingHorizontal: 24 },
  categoryTitle: { fontFamily: 'DMSans-Bold', fontSize: 22, color: '#fff', marginTop: 24, marginBottom: 20 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 8 },
  gridItem: { width: '33.33%', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  gridIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridItemText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#fff', textAlign: 'center' },
  bottomCloseContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  flowerCloseBtn: { alignItems: 'center', justifyContent: 'center' },
  flowerRing1: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(251, 191, 36, 0.15)', justifyContent: 'center', alignItems: 'center' },
  flowerRing2: { width: 100, height: 100, borderRadius: 50, backgroundColor: BRAND.blue, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: BRAND.yellow },
  flowerText: { fontFamily: 'DMSans-Bold', fontSize: 12, color: BRAND.yellow, textAlign: 'center', lineHeight: 16 },
  verificationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  verificationCard: { backgroundColor: '#fff', borderRadius: 24, width: '100%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  verifyingState: { padding: 48, alignItems: 'center' },
  verifyingText: { fontFamily: 'DMSans-Medium', fontSize: 16, color: '#64748B', marginTop: 20 },
  fallbackState: { padding: 24 },
  fallbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fallbackTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A' },
  fallbackSub: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#64748B', marginBottom: 24 },
  mapContainer: { height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F1F5F9', marginBottom: 24 },
  map: { width: '100%', height: '100%' },
  fallbackBtn: { backgroundColor: BRAND.blue, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  fallbackBtnText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#fff' },
  profileOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  profileSheet: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 48, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 24 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 4 },
  profileRole: { fontFamily: 'DMSans-Medium', fontSize: 12, color: '#64748B', letterSpacing: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.green, marginRight: 6 },
  statusText: { fontFamily: 'DMSans-Medium', fontSize: 12, color: BRAND.green },
  closeProfileBtn: { position: 'absolute', top: 24, right: 24, width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-end' },
  profileMenu: { marginTop: 8 },
  profileMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  profileMenuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  profileMenuText: { flex: 1, fontFamily: 'DMSans-Medium', fontSize: 16, color: '#1E293B' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: 'DMSans-Bold', fontSize: 24, color: '#0F172A' },
  dtrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dtrDate: { fontFamily: 'DMSans-Medium', fontSize: 16, color: '#1E293B', marginBottom: 4 },
  dtrTime: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#64748B' },
  notifDrawer: { width: width * 0.85, height: '100%', backgroundColor: '#FFFFFF', alignSelf: 'flex-end', shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: Platform.OS === 'web' ? 24 : 64, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  notifTitle: { fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A' },
  notifMarkRead: { fontFamily: 'DMSans-Medium', fontSize: 14, color: BRAND.blue },
  notifItem: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'flex-start' },
  notifItemUnread: { backgroundColor: '#F8FAFC' },
  notifIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  notifItemTitle: { fontFamily: 'DMSans-Bold', fontSize: 15, color: '#0F172A', marginBottom: 4 },
  notifItemDesc: { fontFamily: 'DMSans-Regular', fontSize: 13, color: '#64748B', marginBottom: 8, lineHeight: 18 },
  notifItemTime: { fontFamily: 'DMSans-Medium', fontSize: 11, color: '#94A3B8' },
  notifUnreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.blue, marginTop: 6 },
  equipItem: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  equipImagePlaceholder: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 16, overflow: 'hidden' },
  equipImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  equipTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A', marginBottom: 4 },
  equipSub: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#64748B' },
  equipStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: '#ECFDF5' },
  statusOverdue: { backgroundColor: '#FEF2F2' },
  equipStatusText: { fontFamily: 'DMSans-Bold', fontSize: 10, letterSpacing: 1 },
  textActive: { color: BRAND.green },
  textOverdue: { color: BRAND.red },
  newTicketBtn: { backgroundColor: BRAND.blue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, marginBottom: 16, marginTop: 16 },
  newTicketBtnText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#fff' },
  ticketItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ticketTitle: { fontFamily: 'DMSans-Bold', fontSize: 15, color: '#0F172A', marginBottom: 4 },
  ticketSub: { fontFamily: 'DMSans-Medium', fontSize: 12, color: '#64748B' },
  ticketBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeOpen: { backgroundColor: '#FEF3C7' },
  badgeResolved: { backgroundColor: '#ECFDF5' },
  ticketBadgeText: { fontFamily: 'DMSans-Bold', fontSize: 10, letterSpacing: 1 },
  badgeTextOpen: { color: BRAND.yellow },
  badgeTextResolved: { color: BRAND.green },
  inputLabel: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#1E293B', marginBottom: 8, marginTop: 16 },
  inputField: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'DMSans-Medium', fontSize: 15, color: '#0F172A' },
  textInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'DMSans-Medium', fontSize: 15, color: '#0F172A' },
  updateCard: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'flex-start' },
  categoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent' },
  categoryPillActive: { backgroundColor: '#EFF6FF', borderColor: BRAND.blue },
  categoryPillText: { fontFamily: 'DMSans-Medium', fontSize: 13, color: '#64748B' },
  categoryPillTextActive: { color: BRAND.blue, fontFamily: 'DMSans-Bold' },
  submitBtn: { backgroundColor: BRAND.green, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  submitBtnText: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#fff' },
  updateItem: { flexDirection: 'row', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'flex-start' },
  updateIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  updateTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A', marginBottom: 6 },
  updateSub: { fontFamily: 'DMSans-Medium', fontSize: 12, color: '#64748B', marginBottom: 12 },
  updateContent: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#475569', lineHeight: 22 },
  woItem: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  woTitle: { fontFamily: 'DMSans-Bold', fontSize: 16, color: '#0F172A', marginBottom: 4 },
  woDesc: { fontFamily: 'DMSans-Regular', fontSize: 14, color: '#475569', marginBottom: 8 },
  woDate: { fontFamily: 'DMSans-Medium', fontSize: 12, color: BRAND.yellow },
  woActionBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  woPending: { backgroundColor: '#fff', borderColor: '#E2E8F0' },
  woCompleted: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  payslipCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  payslipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payslipPeriodTitle: { fontFamily: 'DMSans-Bold', fontSize: 10, color: '#94A3B8', letterSpacing: 1, marginBottom: 4 },
  payslipPeriod: { fontFamily: 'DMSans-Bold', fontSize: 14, color: '#0F172A' },
  payslipNetBox: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'flex-end' },
  payslipNetLabel: { fontFamily: 'DMSans-Medium', fontSize: 10, color: BRAND.green, marginBottom: 2 },
  payslipNetValue: { fontFamily: 'DMSans-Bold', fontSize: 16, color: BRAND.green },
  payslipDetails: { marginTop: 16 },
  payslipDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 16 },
  payslipRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payslipCol: { flex: 1, paddingRight: 8 },
  payslipSectionTitle: { fontFamily: 'DMSans-Bold', fontSize: 12, color: '#0F172A', marginBottom: 12 },
  payslipLineItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  payslipLineLabel: { fontFamily: 'DMSans-Regular', fontSize: 12, color: '#64748B' },
  payslipLineValue: { fontFamily: 'DMSans-Medium', fontSize: 12, color: '#0F172A' },
  payslipFooter: { marginTop: 16, alignItems: 'center' },
  payslipFooterText: { fontFamily: 'DMSans-Medium', fontSize: 10, color: '#CBD5E1' },
  payslipSectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  payslipLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
});


