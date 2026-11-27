// TimeField: a label and a box showing the chosen time ("7:55 AM"); tapping it opens the phone's own time picker.
// Value is "HH:MM" (24-hour), or '' when nothing is chosen yet. The same look as DateField.
import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Props = { label: string; value: string; onChange: (hhmm: string) => void; placeholder: string };

const at = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h!, m!, 0, 0); return d; };
const pad = (n: number) => String(n).padStart(2, '0');

export default function TimeField({ label, value, onChange, placeholder }: Props) {
  const { c, radius } = useTokens();
  const [open, setOpen] = useState(false);
  const shown = value ? at(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : placeholder;
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Txt variant="label">{label}</Txt>
      <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 14, borderRadius: radius.control, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
          <Feather name="clock" size={16} color={c.ink2} />
          <Txt variant="body" style={{ color: value ? c.ink : c.ink3, fontSize: 15 }} numberOfLines={1}>{shown}</Txt>
        </View>
      </PressableScale>
      {open && (
        <DateTimePicker value={value ? at(value) : at('08:00')} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, d) => { setOpen(Platform.OS === 'ios'); if (e.type === 'set' && d) onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`); }} />
      )}
    </View>
  );
}
