import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import RNModal from 'react-native-modal';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/use-theme';
import { CompanyPolicy } from './PolicyReaderModal';

const { width } = Dimensions.get('window');

const BRAND = {
  blue: '#1E3A8A',
  yellow: '#FBBF24',
  green: '#10B981',
  red: '#EF4444',
};

interface PolicyEnforcementModalProps {
  visible: boolean;
  unacknowledgedPolicies: CompanyPolicy[];
  reason: 'post_punch';
  onReview: (policy: CompanyPolicy) => void;
  onDismiss: () => void;
}

export default function PolicyEnforcementModal({
  visible,
  unacknowledgedPolicies,
  reason,
  onReview,
  onDismiss,
}: PolicyEnforcementModalProps) {
  const { colors, isDark } = useAppTheme();

  if (!unacknowledgedPolicies || unacknowledgedPolicies.length === 0) return null;

  const targetPolicy = unacknowledgedPolicies[0];

  // Shown after a time-in when a must-read company policy isn't signed yet. Never blocks anything.
  // (The app rules, Terms and Privacy, are agreed to once in first-time setup.)
  const getReasonMeta = () => ({
    title: 'Time-in saved',
    subtitle: 'One more thing',
    badgeText: 'Timed in',
    badgeColor: BRAND.green,
    badgeBg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5',
    description: 'There is a company policy you haven’t read yet. It only takes a minute.',
    dismissText: 'Later',
  });

  const meta = getReasonMeta();

  return (
    <RNModal useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      isVisible={visible}
      onBackdropPress={onDismiss}
      onBackButtonPress={onDismiss}
      style={{ margin: 20, justifyContent: 'center' }}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
            <Feather name="shield" size={28} color="#D97706" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <View style={[styles.statusBadge, { backgroundColor: meta.badgeBg }]}>
                <Text style={[styles.statusBadgeText, { color: meta.badgeColor }]}>{meta.badgeText}</Text>
              </View>
              {unacknowledgedPolicies.length > 1 && (
                <View style={[styles.countBadge, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                  <Text style={[styles.countBadgeText, { color: colors.textMuted }]}>
                    +{unacknowledgedPolicies.length - 1} more
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{meta.title}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{meta.subtitle}</Text>
          </View>
        </View>

        {/* Narrative Description */}
        <Text style={[styles.description, { color: colors.text }]}>{meta.description}</Text>

        {/* Highlighted Policy Preview Card */}
        <View
          style={[
            styles.policyCard,
            {
              backgroundColor: isDark ? colors.subCard : '#F8FAFC',
              borderColor: isDark ? colors.cardBorder : '#E2E8F0',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text style={[styles.policyTitle, { color: colors.text }]} numberOfLines={1}>
              {targetPolicy.title}
            </Text>
            <View style={[styles.verPill, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
              <Text style={[styles.verPillText, { color: colors.textMuted }]}>{targetPolicy.version}</Text>
            </View>
          </View>

          <Text style={[styles.policySummary, { color: colors.textMuted }]} numberOfLines={3}>
            {targetPolicy.summary}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="calendar" size={12} color={colors.textSubtle} style={{ marginRight: 4 }} />
              <Text style={[styles.policyMetaText, { color: colors.textSubtle }]}>
                Effective: {targetPolicy.effective_date}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="users" size={12} color={colors.textSubtle} style={{ marginRight: 4 }} />
              <Text style={[styles.policyMetaText, { color: colors.textSubtle }]}>
                For {targetPolicy.target_audience === 'all' ? 'everyone' : 'field staff'}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onReview(targetPolicy)}
            activeOpacity={0.8}
          >
            <Feather name="file-text" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Read it</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textMuted }]}>
              {meta.dismissText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
  },
  title: {
    fontFamily: 'DMSans-Bold',
    fontSize: 15,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
  },
  description: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  policyCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  policyTitle: {
    flex: 1,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    marginRight: 8,
  },
  verPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  verPillText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
  },
  policySummary: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  policyMetaText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
  },
  actions: {
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: BRAND.blue,
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },
});
