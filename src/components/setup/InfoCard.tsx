// A card with an icon, a bold line and a short explanation. Used for the app-rule points and
// permissions; `status` shows Allowed / Not allowed on the right (permissions).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

type Status = { label: string; tone: 'good' | 'bad' | 'neutral' };
type Props = { icon: React.ComponentProps<typeof Feather>['name']; title: string; text: string; status?: Status; tint?: string };

const TONES = { good: '#059669', bad: '#DC2626', neutral: '#64748B' };

export default function InfoCard({ icon, title, text, status, tint = '#2563EB' }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={[styles.icon, { backgroundColor: `${tint}1F` }]}>
        <Feather name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>{text}</Text>
        {status && (
          <View style={styles.statusRow}>
            <Feather
              name={status.tone === 'good' ? 'check-circle' : status.tone === 'bad' ? 'alert-circle' : 'circle'}
              size={14}
              color={TONES[status.tone]}
            />
            <Text style={[styles.status, { color: TONES[status.tone] }]}>{status.label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'DMSans-Bold', fontSize: 15, marginBottom: 3 },
  text: { fontFamily: 'DMSans-Regular', fontSize: 14, lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  status: { fontFamily: 'DMSans-Bold', fontSize: 13 },
});
