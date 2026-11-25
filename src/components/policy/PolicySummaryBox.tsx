import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BRAND } from './types';

interface PolicySummaryBoxProps {
  summary: string;
  isDark: boolean;
  colors: any;
}

export function PolicySummaryBox({ summary, isDark, colors }: PolicySummaryBoxProps) {
  return (
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
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
