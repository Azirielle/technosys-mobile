// Full-screen reader for one company policy, with the "I've read this" button.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/use-theme';

const BRAND = {
  blue: '#1E3A8A',
  accentBlue: '#2563EB',
  yellow: '#FBBF24',
  green: '#10B981',
  red: '#EF4444',
};

export interface CompanyPolicy {
  id: string;
  title: string;
  category: 'legal' | 'field_ops' | 'hr_attendance' | 'inventory' | 'executive' | string;
  version: string;
  effective_date: string;
  target_audience: string;
  summary: string;
  content_markdown: string;
  is_mandatory: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PolicyReaderModalProps {
  visible: boolean;
  policy: CompanyPolicy | null;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
  onClose: () => void;
  onAcknowledge?: (policyId: string, version: string) => Promise<boolean>;
  readOnly?: boolean;
}

// Markdown renderer tailored for mobile policy presentation
const PolicyMarkdownRenderer = ({ markdown, isDark, colors, title }: { markdown: string; isDark: boolean; colors: any; title?: string }) => {
  if (!markdown) return null;

  // The header already shows the title, so a first "# Title" line that repeats it is skipped.
  const allLines = markdown.split('\n');
  const firstText = allLines.findIndex(l => l.trim() !== '');
  const lines = allLines.filter((line, i) =>
    !(i === firstText && !!title && line.trim().replace(/^#\s+/, '').toLowerCase() === title.trim().toLowerCase())
  );

  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed === '') {
          return <View key={idx} style={{ height: 6 }} />;
        }

        // Divider line (---, ***, ___)
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          return <View key={idx} style={{ height: 1, backgroundColor: isDark ? '#334155' : '#E2E8F0', marginVertical: 10 }} />;
        }

        // Quote (> ...): shown as a paragraph without the marker
        if (trimmed.startsWith('>')) {
          return (
            <Text key={idx} style={{ fontFamily: 'DMSans-Regular', fontSize: 13, color: colors.textMuted, lineHeight: 20, fontStyle: 'italic' }}>
              {renderFormattedInline(trimmed.replace(/^>\s*/, ''), colors.textMuted)}
            </Text>
          );
        }

        // Heading 1 (# ...)
        if (trimmed.startsWith('# ')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Bold',
                fontSize: 18,
                color: colors.text,
                marginTop: 14,
                marginBottom: 4,
              }}
            >
              {trimmed.replace(/^#\s+/, '')}
            </Text>
          );
        }

        // Heading 2 (## ...)
        if (trimmed.startsWith('## ')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Bold',
                fontSize: 16,
                color: isDark ? '#60A5FA' : BRAND.accentBlue,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              {trimmed.replace(/^##\s+/, '')}
            </Text>
          );
        }

        // Heading 3 (### ...)
        if (trimmed.startsWith('### ')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Bold',
                fontSize: 14,
                color: colors.text,
                marginTop: 8,
                marginBottom: 2,
              }}
            >
              {trimmed.replace(/^###\s+/, '')}
            </Text>
          );
        }

        // Bullet point (- or * )
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[-*]\s+/, '');
          return (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4, marginVertical: 2 }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: isDark ? '#60A5FA' : BRAND.accentBlue,
                  marginTop: 7,
                  marginRight: 8,
                }}
              />
              <Text style={{ flex: 1, fontFamily: 'DMSans-Regular', fontSize: 13, color: colors.text, lineHeight: 19 }}>
                {renderFormattedInline(content, colors.text)}
              </Text>
            </View>
          );
        }

        // Numbered list (1. 2. etc)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const content = numMatch[2];
          return (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4, marginVertical: 2 }}>
              <Text
                style={{
                  fontFamily: 'DMSans-Bold',
                  fontSize: 12,
                  color: isDark ? '#94A3B8' : '#64748B',
                  width: 20,
                  marginTop: 1,
                }}
              >
                {num}.
              </Text>
              <Text style={{ flex: 1, fontFamily: 'DMSans-Regular', fontSize: 13, color: colors.text, lineHeight: 19 }}>
                {renderFormattedInline(content, colors.text)}
              </Text>
            </View>
          );
        }

        // Standard Paragraph
        return (
          <Text
            key={idx}
            style={{
              fontFamily: 'DMSans-Regular',
              fontSize: 13,
              color: colors.text,
              lineHeight: 20,
              marginVertical: 2,
            }}
          >
            {renderFormattedInline(trimmed, colors.text)}
          </Text>
        );
      })}
    </View>
  );
};

// Formats inline **bold** and *italic* text segments
const renderFormattedInline = (text: string, defaultColor: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <Text key={index} style={{ fontFamily: 'DMSans-Bold', color: defaultColor }}>
          {part}
        </Text>
      );
    }

    const italicParts = part.split(/\*(.*?)\*/g);
    if (italicParts.length > 1) {
      return italicParts.map((iPart, iIdx) => {
        if (iIdx % 2 === 1) {
          return (
            <Text key={`${index}-${iIdx}`} style={{ fontStyle: 'italic', color: defaultColor }}>
              {iPart}
            </Text>
          );
        }
        return <Text key={`${index}-${iIdx}`} style={{ color: defaultColor }}>{iPart}</Text>;
      });
    }

    return <Text key={index} style={{ color: defaultColor }}>{part}</Text>;
  });
};

export default function PolicyReaderModal({
  visible,
  policy,
  isAcknowledged,
  acknowledgedAt,
  onClose,
  onAcknowledge,
  readOnly = false,
}: PolicyReaderModalProps) {
  const { colors, isDark } = useAppTheme();
  const [submitting, setSubmitting] = useState(false);

  if (!policy) return null;

  const getCategoryMeta = (cat: string) => {
    switch (cat) {
      case 'legal':
        return { label: 'App rules', icon: 'file-text' as const, color: '#3B82F6', bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF' };
      case 'field_ops':
        return { label: 'Safety', icon: 'shield' as const, color: '#10B981', bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' };
      case 'hr_attendance':
        return { label: 'Attendance', icon: 'clock' as const, color: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' };
      case 'inventory':
        return { label: 'Tools', icon: 'tool' as const, color: '#06B6D4', bg: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF' };
      case 'executive':
        return { label: 'Company rules', icon: 'award' as const, color: '#8B5CF6', bg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF' };
      default:
        return { label: 'Policy', icon: 'file' as const, color: '#64748B', bg: isDark ? 'rgba(100, 116, 139, 0.15)' : '#F8FAFC' };
    }
  };

  const meta = getCategoryMeta(policy.category);

  const handleSign = async () => {
    if (!onAcknowledge) return;
    setSubmitting(true);
    try {
      const ok = await onAcknowledge(policy.id, policy.version);
      if (ok) {
        if (Platform.OS === 'web') {
          window.alert(`Signed\n\nThanks! HR can see you've read ${policy.title}.`);
        } else {
          Alert.alert('Signed', `Thanks! HR can see you've read ${policy.title}.`);
        }
        onClose();
      }
    } catch (err: any) {
      const msg = "Couldn't save that. Please check your signal and try again.";
      if (Platform.OS === 'web') {
        window.alert(`Error\n\n${msg}`);
      } else {
        Alert.alert("Not saved", msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // React Native's own Modal, full screen: no drag-to-close gesture, so scrolling the policy
    // can't fight with the sheet (it did in the 16 Nov recording). Close with X or the back button.
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }} edges={['top', 'bottom']}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>

          {/* Modal Header */}
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

          {/* Scrollable Policy Body */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 5-Second Executive Summary Box */}
            <View
              style={[
                styles.summaryBox,
                {
                  backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Feather name="info" size={16} color={isDark ? '#60A5FA' : BRAND.accentBlue} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.summaryTitle,
                    { color: isDark ? '#93C5FD' : BRAND.blue },
                  ]}
                >
                  In short
                </Text>
              </View>
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {policy.summary}
              </Text>
            </View>

            {/* Complete Markdown Document Body */}
            <View style={styles.markdownContainer}>
              <PolicyMarkdownRenderer markdown={policy.content_markdown} isDark={isDark} colors={colors} title={policy.title} />
            </View>
          </ScrollView>

          {/* Footer Action Strip */}
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
                  onPress={handleSign}
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
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingTop: 12,
  },
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
  scrollBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  summaryBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.accentBlue,
    marginBottom: 16,
  },
  summaryTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  summaryText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  markdownContainer: {
    paddingBottom: 20,
  },
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
