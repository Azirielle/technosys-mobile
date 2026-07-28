import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

const COLORS = {
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  background: '#f8fafc',
  card: '#ffffff',
  textMain: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  indigo: '#4f46e5',
  indigoDim: 'rgba(79, 70, 229, 0.1)',
  vip: '#ef4444',
  vipBg: 'rgba(239, 68, 68, 0.1)'
};

const { width } = Dimensions.get('window');

interface SchedulesTabProps {
  schedules?: any[];
  isDarkMode?: boolean;
  language?: string;
  openDirections?: (location: string) => void;
  formatTime?: (timeStr: string) => string;
  userId?: string;
  isOnline?: boolean;
}

export default function SchedulesTab({ schedules = [], isDarkMode = false, language = 'en', openDirections = () => {}, formatTime = (t: string) => t, userId, isOnline }: SchedulesTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Map schedules by day
  const schedulesByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    schedules.forEach(sched => {
      const d = new Date(sched.start_time);
      if (d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(sched);
      }
    });
    return map;
  }, [schedules, currentDate]);

  const monthNames = language === 'fil' 
    ? ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const daysOfWeek = language === 'fil' 
    ? ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const themeColors = {
    bg: isDarkMode ? '#0f172a' : COLORS.background,
    card: isDarkMode ? '#1e293b' : COLORS.card,
    text: isDarkMode ? '#f1f5f9' : COLORS.textMain,
    textMuted: isDarkMode ? '#94a3b8' : COLORS.textMuted,
    border: isDarkMode ? '#334155' : COLORS.border,
  };

  const renderCalendarGrid = () => {
    const grid = [];
    let dayCounter = 1;
    
    // Create 6 rows (weeks)
    for (let row = 0; row < 6; row++) {
      const rowCells = [];
      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < firstDay) {
          rowCells.push(<View key={`empty-${col}`} style={styles.cellEmpty} />);
        } else if (dayCounter <= daysInMonth) {
          const day = dayCounter;
          const daySchedules = schedulesByDay[day] || [];
          const hasVip = daySchedules.some(s => s.is_vip_hook);
          
          rowCells.push(
            <View key={`day-${day}`} style={[styles.cell, { borderColor: themeColors.border }]}>
              <Text style={[styles.cellDayText, { color: themeColors.text }]}>{day}</Text>
              {daySchedules.length > 0 && (
                <View style={styles.badgeContainer}>
                  {hasVip ? (
                    <View style={styles.vipDot} />
                  ) : (
                    <View style={styles.standardDot} />
                  )}
                  <Text style={[styles.badgeText, { color: themeColors.textMuted }]}>
                    {daySchedules.length}
                  </Text>
                </View>
              )}
            </View>
          );
          dayCounter++;
        } else {
          rowCells.push(<View key={`empty-end-${dayCounter}`} style={styles.cellEmpty} />);
          dayCounter++;
        }
      }
      grid.push(<View key={`row-${row}`} style={styles.gridRow}>{rowCells}</View>);
      if (dayCounter > daysInMonth) break;
    }
    return grid;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: themeColors.text }]}>
        {language === 'fil' ? 'Kalendaryo ng Iskedyul' : 'Schedule Calendar'}
      </Text>

      {/* Calendar Header */}
      <View style={[styles.calendarHeader, { backgroundColor: themeColors.card }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <Feather name="chevron-left" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: themeColors.text }]}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <Feather name="chevron-right" size={24} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View style={[styles.calendarGrid, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.daysHeader}>
          {daysOfWeek.map((day, idx) => (
            <Text key={day} style={[styles.dayHeaderText, { color: themeColors.textMuted }]}>{day}</Text>
          ))}
        </View>
        {renderCalendarGrid()}
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={styles.vipDot} />
          <Text style={[styles.legendText, { color: themeColors.textMuted }]}>
            {language === 'fil' ? 'Priority Dispatch' : 'Priority Dispatch'}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.standardDot} />
          <Text style={[styles.legendText, { color: themeColors.textMuted }]}>
            {language === 'fil' ? 'Karaniwan' : 'Standard'}
          </Text>
        </View>
      </View>

      {/* Upcoming List */}
      <Text style={[styles.upcomingTitle, { color: themeColors.text }]}>
        {language === 'fil' ? 'Lahat ng Iskedyul' : 'All Schedules'}
      </Text>
      
      {schedules.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: themeColors.card }]}>
          <Feather name="check-square" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
          <Text style={{ color: themeColors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
            {language === 'fil' ? 'Lahat ay Naisagawa!' : 'All caught up!'}
          </Text>
          <Text style={{ color: themeColors.textMuted, fontSize: 13, textAlign: 'center' }}>
            {language === 'fil' ? 'Walang nakatakdang dispatch.' : 'No dispatches scheduled.'}
          </Text>
        </View>
      ) : (
        schedules.map(sched => (
          <View key={sched.id} style={[
            styles.dispatchCard, 
            { backgroundColor: themeColors.card, borderLeftColor: sched.is_vip_hook ? COLORS.vip : '#64748b' }
          ]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={[
                styles.dispatchBadge, 
                { backgroundColor: sched.is_vip_hook ? COLORS.vipBg : 'rgba(100, 116, 139, 0.1)', borderColor: sched.is_vip_hook ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)' }
              ]}>
                <Text style={[styles.dispatchBadgeText, { color: sched.is_vip_hook ? COLORS.vip : '#64748b' }]}>
                  {sched.is_vip_hook ? (language === 'fil' ? 'URGENT' : 'URGENT') : (language === 'fil' ? 'KARANIWAN' : 'STANDARD')}
                </Text>
              </View>
              {sched.attendance_mode && (
                <View style={styles.attendanceBadge}>
                  <Text style={styles.attendanceBadgeText}>
                    💼 {sched.attendance_mode === 'hq' ? 'HQ Standard' : (sched.attendance_mode === 'direct_dispatch' ? (language === 'fil' ? 'Direktang Dispatch' : 'Direct Dispatch') : (language === 'fil' ? 'Labas ng Bayan' : 'Out-of-Town'))}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.dispatchTitle, { color: themeColors.text }]}>{sched.client_name}</Text>
            <Text style={[styles.dispatchTime, { color: themeColors.textMuted }]}>
              <Feather name="calendar" size={12}/> {new Date(sched.start_time).toLocaleDateString()} | <Feather name="clock" size={12}/> {formatTime(sched.start_time)}{sched.end_time ? ` - ${formatTime(sched.end_time)}` : ''}
            </Text>
            
            <TouchableOpacity onPress={() => openDirections(sched.location)} style={styles.directionsButton}>
              <Feather name="map-pin" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.directionsButtonText} numberOfLines={1}>{sched.location}</Text>
              <Feather name="corner-up-right" size={14} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>
        ))
      )}
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '700',
  },
  calendarGrid: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  daysHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 12,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    padding: 4,
    justifyContent: 'space-between',
  },
  cellEmpty: {
    flex: 1,
    aspectRatio: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  cellDayText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 'auto',
  },
  vipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.vip,
    marginRight: 4,
  },
  standardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748b',
    marginRight: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  upcomingTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  dispatchCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dispatchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dispatchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  attendanceBadge: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attendanceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  dispatchTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  dispatchTime: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    padding: 10,
    borderRadius: 8,
  },
  directionsButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderStyle: 'dashed',
  },
});
