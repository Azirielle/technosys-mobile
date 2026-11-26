// ForgottenShiftSheet: "You didn't time out on Sun, Nov 15. What time did you leave?" Quick choices
// (5, 6, 7 PM) or another time, the hours that will be counted, and Save. HR checks it afterwards.
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import RNModal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useT } from '../../lib/i18n';
import { hhmm, previewLeftAt, quickChoices } from '../../lib/forgottenShift';
import type { ShiftLog } from '../../lib/timeIn';
import { Button, IconChip, Txt, useTokens } from '../../ui';

type Props = { shift: ShiftLog | null; onSave: (time: string) => Promise<boolean>; onLater: () => void; /** That day's job start and end, "HH:MM:SS" */ jobStart?: string | null; jobEnd?: string | null };

export default function ForgottenShiftSheet({ shift, onSave, onLater, jobStart, jobEnd }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const start = useMemo(() => (shift ? new Date(shift.app_time_in) : null), [shift]);
  const choices = useMemo(() => (start ? quickChoices(start, jobEnd, jobStart) : []), [start, jobEnd, jobStart]);
  const [time, setTime] = useState('17:00');
  const [custom, setCustom] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // A new forgotten shift starts on the first quick choice
  useEffect(() => { if (choices[0]) { setTime(choices[0].time); setCustom(false); } }, [choices]);

  if (!start) return null;
  const preview = previewLeftAt(start, time);
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      style={{ flex: 1, paddingVertical: 10, borderRadius: radius.chip, alignItems: 'center', borderWidth: 1,
        backgroundColor: selected ? c.brand : c.card, borderColor: selected ? c.brand : c.line }}>
      <Txt variant="label" style={{ fontSize: 12, color: selected ? c.onBrand : c.ink }}>{label}</Txt>
    </Pressable>
  );
  const row = (label: string, value: string, strong?: boolean) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt variant="caption" color={strong ? 'ink' : 'ink2'}>{label}</Txt>
      <Txt variant="caption" color={strong ? 'ok' : 'ink'}>{value}</Txt>
    </View>
  );

  const save = async () => { setSaving(true); await onSave(time); setSaving(false); };

  return (
    <RNModal isVisible={!!shift} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={saving ? undefined : onLater} onBackButtonPress={saving ? undefined : onLater} style={{ margin: 20, justifyContent: 'center' }}>
      <View style={{ backgroundColor: c.card, borderRadius: radius.card, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconChip icon="clock" tone="neutral" />
          <Txt variant="heading" style={{ flex: 1 }}>{t('forgotten.title', { date: day })}</Txt>
        </View>
        <Txt variant="body" color="ink2">{t('forgotten.text', { time: start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</Txt>

        <View style={{ backgroundColor: c.cardSoft, borderRadius: radius.control, padding: 12, gap: 8 }}>
          <Txt variant="label">{t('forgotten.leftAt')}</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {choices.map((ch) => chip(ch.label, !custom && time === ch.time, () => { setCustom(false); setTime(ch.time); }))}
            {chip(custom ? time : t('forgotten.otherTime'), custom, () => setPicking(true))}
          </View>
          <View style={{ height: 1, backgroundColor: c.line, marginVertical: 4 }} />
          {row(t('forgotten.leftAtRow'), `${preview.leftAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${preview.leftAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)}
          {row(t('forgotten.atWork'), `${preview.atWork} h`)}
          {row(t('forgotten.lunch'), preview.lunch ? '−1 h' : t('forgotten.lunchNone'))}
          {row(t('forgotten.counted'), `${preview.counted} h`, true)}
          {preview.veryLong && <Txt variant="caption" color="pending">{t('forgotten.veryLong')}</Txt>}
        </View>

        {picking && (
          <DateTimePicker value={new Date(new Date(start).setHours(...(time.split(':').map(Number) as [number, number])))} mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, picked) => {
              setPicking(Platform.OS === 'ios');
              if (picked) { setTime(hhmm(picked)); setCustom(true); }
            }} />
        )}

        <View style={{ gap: 10 }}>
          <Button icon="check-circle" label={t('forgotten.save', { hours: preview.counted })} onPress={save} loading={saving} disabled={!preview.valid} />
          <Button kind="ghost" size="md" label={t('timeIn.later')} onPress={onLater} disabled={saving} />
        </View>
      </View>
    </RNModal>
  );
}
