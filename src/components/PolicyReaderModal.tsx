// Full-screen reader for one company policy, with the "I've read this" button.
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/use-theme';
import { appAlert } from '../ui';
import {
  BRAND,
  type CompanyPolicy,
  type PolicyReaderModalProps,
  getCategoryMeta,
} from './policy/types';
import { PolicyHeader } from './policy/PolicyHeader';
import { PolicySummaryBox } from './policy/PolicySummaryBox';
import { PolicyMarkdownRenderer } from './policy/PolicyMarkdownRenderer';
import { PolicyFooter } from './policy/PolicyFooter';

export type { CompanyPolicy, PolicyReaderModalProps };
export { BRAND };

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

  const meta = getCategoryMeta(policy.category, isDark);

  const handleSign = async () => {
    if (!onAcknowledge) return;
    setSubmitting(true);
    try {
      const ok = await onAcknowledge(policy.id, policy.version);
      if (ok) {
        if (Platform.OS === 'web') {
          window.alert(`Signed\n\nThanks! HR can see you've read ${policy.title}.`);
        } else {
          appAlert('Signed', `Thanks! HR can see you've read ${policy.title}.`);
        }
        onClose();
      }
    } catch (err: any) {
      const msg = "Couldn't save that. Please check your signal and try again.";
      if (Platform.OS === 'web') {
        window.alert(`Error\n\n${msg}`);
      } else {
        appAlert("Not saved", msg);
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
          <PolicyHeader
            policy={policy}
            meta={meta}
            isDark={isDark}
            colors={colors}
            onClose={onClose}
          />

          {/* Scrollable Policy Body */}
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 5-Second Executive Summary Box */}
            <PolicySummaryBox
              summary={policy.summary}
              isDark={isDark}
              colors={colors}
            />

            {/* Complete Markdown Document Body */}
            <View style={styles.markdownContainer}>
              <PolicyMarkdownRenderer
                markdown={policy.content_markdown}
                isDark={isDark}
                colors={colors}
                title={policy.title}
              />
            </View>
          </ScrollView>

          {/* Footer Action Strip */}
          <PolicyFooter
            policy={policy}
            isAcknowledged={isAcknowledged}
            acknowledgedAt={acknowledgedAt}
            readOnly={readOnly}
            submitting={submitting}
            isDark={isDark}
            colors={colors}
            onClose={onClose}
            onSign={handleSign}
          />
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
  scrollBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  markdownContainer: {
    paddingBottom: 20,
  },
});
