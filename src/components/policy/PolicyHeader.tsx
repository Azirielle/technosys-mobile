import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BRAND, type CategoryMeta, type CompanyPolicy } from './types';

interface PolicyHeaderProps {
  policy: CompanyPolicy;
  meta: CategoryMeta;
  isDark: boolean;
  colors: any;
  onClose: () => void;
}

export function PolicyHeader({ policy, meta, isDark, colors, onClose }: PolicyHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <View style={[styles.catBadge, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon} size={11} color={meta.color} style={{ marginRight: 4 }} />
            <Text style={[styles.catBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <View style={[styles.verBadge, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <Text style={[styles.verBadgeText, { color: colors.textMuted }]}>{policy.version}</Text>
          </View>
          {policy.is_mandatory && (
            <View style={[styles.mandBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
              <Text style={[styles.mandBadgeText, { color: BRAND.red }]}>Must read</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {policy.title}
        </Text>
        <Text style={[styles.dateText, { color: colors.textMuted }]}>
          Starts {policy.effective_date} · For {policy.target_audience === 'all' ? 'everyone' : 'field staff'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onClose}
        style={[styles.closeBtn, { backgroundColor: isDark ? colors.subCard : '#F1F5F9' }]}
        activeOpacity={0.7}
      >
        <Feather name="x" size={20} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  verBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
  },
  mandBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mandBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'DMSans-Bold',
    fontSize: 17,
    lineHeight: 22,
    marginTop: 2,
  },
  dateText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
