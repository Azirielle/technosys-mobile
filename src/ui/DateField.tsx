// DateField: a label and a box showing the chosen date ("Thu, Nov 20"); tapping it opens the phone's own date
// picker. Value is YYYY-MM-DD (local day), or '' when nothing is chosen yet.
import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Props = { label: string; value: string; onChange: (ymd: string) => void; placeholder: string; minimumDate?: Date };

const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromYmd = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y!, m! - 1, d!); };

export default function DateField({ label, value, onChange, placeholder, minimumDate }: Props) {
  const { c, radius } = useTokens();
  const [open, setOpen] = useState(false);
  const shown = value ? fromYmd(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : placeholder;
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Txt variant="label">{label}</Txt>
      <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 14, borderRadius: radius.control, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
          <Feather name="calendar" size={16} color={c.ink2} />
          <Txt variant="body" style={{ color: value ? c.ink : c.ink3, fontSize: 15 }} numberOfLines={1}>{shown}</Txt>
        </View>
      </PressableScale>
      {open && (
        <DateTimePicker value={value ? fromYmd(value) : minimumDate ?? new Date()} mode="date" minimumDate={minimumDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(e, d) => { setOpen(Platform.OS === 'ios'); if (e.type === 'set' && d) onChange(toYmd(d)); }} />
      )}
    </View>
  );
}
