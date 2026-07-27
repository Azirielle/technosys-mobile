import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  language?: 'en' | 'fil';
  isDarkMode?: boolean;
}

const COLORS = {
  primary: '#10b981',
  primaryDim: 'rgba(16, 185, 129, 0.1)',
  textMain: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  card: '#f8fafc',
};

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  language = 'en',
  isDarkMode = false,
}: PaginationProps) {
  if (isDarkMode) {
    COLORS.card = '#1e293b';
    COLORS.border = '#334155';
    COLORS.textMuted = '#94a3b8';
    COLORS.textMain = '#f8fafc';
  } else {
    COLORS.card = '#f8fafc';
    COLORS.border = '#e2e8f0';
    COLORS.textMuted = '#64748b';
    COLORS.textMain = '#0f172a';
  }

  const styles = getStyles(COLORS);
  if (totalPages <= 1) return null;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const showLabel = language === 'fil'
    ? `Ipinapakita ang ${totalItems === 0 ? 0 : startIndex + 1}-${endIndex} sa ${totalItems}`
    : `Showing ${totalItems === 0 ? 0 : startIndex + 1}-${endIndex} of ${totalItems}`;

  return (
    <View style={styles.container}>
      <Text style={styles.statsText}>{showLabel}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          style={[styles.button, currentPage === 1 && styles.disabledButton]}
        >
          <Feather name="chevron-left" size={16} color={currentPage === 1 ? COLORS.textMuted : COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            {language === 'fil' ? `${currentPage} / ${totalPages}` : `${currentPage} of ${totalPages}`}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={[styles.button, currentPage === totalPages && styles.disabledButton]}
        >
          <Feather name="chevron-right" size={16} color={currentPage === totalPages ? COLORS.textMuted : COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(COLORS: any) { return StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 8,
  },
  statsText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.4,
    backgroundColor: '#f1f5f9',
  },
  pageIndicator: {
    paddingHorizontal: 8,
  },
  pageText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
}); }