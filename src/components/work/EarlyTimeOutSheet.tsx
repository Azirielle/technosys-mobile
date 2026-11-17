// EarlyTimeOutSheet (Work v2): shown when the database says a time-out is early (15+ min before the job's end).
// Says when the job ends and how early this is, asks why, then times out with that reason. The Coordinator checks it.
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import RNModal from 'react-native-modal';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { Button, ChoiceCard, TextBox, Txt, useTokens } from '../../ui';

type Props = { early: { endsAt: string; minutes: number } | null; busy: boolean; onTimeOut: (reason: string) => void; onClose: () => void };
const REASONS = ['jobDone', 'sick', 'sentHome', 'other'] as const;

export default function EarlyTimeOutSheet({ early, busy, onTimeOut, onClose }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('jobDone');
  const [other, setOther] = useState('');
  const text = reason === 'other' ? other.trim() : t(`work.early_${reason}`);
  const h = Math.floor((early?.minutes ?? 0) / 60), m = (early?.minutes ?? 0) % 60;

  return (
    <RNModal isVisible={!!early} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={busy ? undefined : onClose} onBackButtonPress={busy ? undefined : onClose} style={{ margin: 0, justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: c.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 20, paddingBottom: 32, maxHeight: '92%' }}>
        <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt variant="title" style={{ flex: 1, fontSize: 20 }}>{t('work.earlyTitle')}</Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
              <Feather name="x" size={24} color={c.ink2} />
            </Pressable>
          </View>
          <Txt variant="body" color="ink2">
            {t('work.earlyText', { end: early ? new Date(early.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '', early: h ? `${h} h ${m} min` : `${m} min` })}
          </Txt>
          <Txt variant="label" style={{ marginTop: 4 }}>{t('work.earlyWhy')}</Txt>
          {REASONS.map((r) => <ChoiceCard key={r} title={t(`work.early_${r}`)} selected={reason === r} onPress={() => setReason(r)} />)}
          {reason === 'other' && <TextBox label={t('work.reasonLabel')} value={other} onChangeText={setOther} placeholder={t('work.reasonPlaceholder')} maxLength={200} />}
          <Button kind="danger" label={t('work.earlyYes')} onPress={() => onTimeOut(text)} loading={busy} disabled={text.length < 3} />
          <Button kind="secondary" label={t('work.earlyStay')} onPress={onClose} disabled={busy} />
          <Txt variant="caption" color="ink2" center>{t('work.earlyNote')}</Txt>
        </ScrollView>
      </View>
    </RNModal>
  );
}
