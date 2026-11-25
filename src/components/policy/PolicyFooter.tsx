import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BRAND, type CompanyPolicy } from './types';

interface PolicyFooterProps {
  policy: CompanyPolicy;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
  readOnly: boolean;
  submitting: boolean;
  isDark: boolean;
  colors: any;
  onClose: () => void;
  onSign: () => void;
}

export function PolicyFooter({
  policy,
  isAcknowledged,
  acknowledgedAt,
  readOnly,
  submitting,
  isDark,
  colors,
  onClose,
  onSign,
}: PolicyFooterProps) {
  return (
    <View style={[styles.footer, { borderTopColor: isDark ? colors.border : '#E2E8F0', backgroundColor: colors.card }]}>
      {isAcknowledged ? (
        <View style={[styles.acknowledgedBanner, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
          <Feather name="check-circle" size={18} color={BRAND.green} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.acknowledgedTitle, { color: isDark ? '#34D399' : '#065F46' }]}>
              You've read and signed this
            </Text>
            {acknowledgedAt && (
              <Text style={[styles.acknowledgedSubtext, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                On {new Date(acknowledgedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
        </View>
      ) : readOnly ? (
        <TouchableOpacity
          style={[styles.dismissBtn, { backgroundColor: isDark ? colors.subCard : '#F1F5F9' }]}
          onPress={onClose}
        >
          <Text style={[styles.dismissBtnText, { color: colors.text }]}>Close</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: '100%' }}>
          <Text style={[styles.legalDisclaimer, { color: colors.textMuted }]}>
            Tapping the button means you read {policy.title} ({policy.version}) and will follow it.
          </Text>

          <TouchableOpacity
            style={[styles.signBtn, submitting && { opacity: 0.7 }]}
            onPress={onSign}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check-square" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.signBtnText}>I've read this</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  acknowledgedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  acknowledgedTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  acknowledgedSubtext: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  legalDisclaimer: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginBottom: 10,
  },
  signBtn: {
    backgroundColor: BRAND.blue,
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  signBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  dismissBtn: {
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
});
