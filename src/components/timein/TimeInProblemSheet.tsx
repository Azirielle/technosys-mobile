// TimeInProblemSheet: when a time-in didn't reach HR. Says what worked and what didn't (location, selfie,
// sent or saved on the phone) in plain words. With a selfie waiting: "Try again" or "Tell HR instead".
import React from 'react';
import { View } from 'react-native';
import RNModal from 'react-native-modal';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import type { Problem } from '../../lib/useTimeIn';
import { Button, IconChip, Txt, useTokens } from '../../ui';

type Props = { problem: Problem; sending: 'selfie' | 'hr' | null; onRetry: () => void; onTellHr: () => void; onClose: () => void };

function Line({ ok, warn, text }: { ok: boolean; warn?: boolean; text: string }) {
  const { c } = useTokens();
  const color = ok ? c.ok : warn ? c.pending : c.error;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Feather name={ok ? 'check-circle' : warn ? 'clock' : 'x-circle'} size={16} color={color} />
      <Txt variant="body" style={{ flex: 1, fontSize: 14 }}>{text}</Txt>
    </View>
  );
}

export default function TimeInProblemSheet({ problem, sending, onRetry, onTellHr, onClose }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const selfie = problem.kind === 'selfie';
  const busy = sending !== null;

  return (
    <RNModal isVisible={problem.open} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={busy ? undefined : onClose} onBackButtonPress={busy ? undefined : onClose} style={{ margin: 20, justifyContent: 'center' }}>
      <View style={{ backgroundColor: c.card, borderRadius: radius.card, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconChip icon={problem.kind === 'queued' ? 'wifi-off' : 'alert-triangle'} tone={problem.kind === 'queued' ? 'neutral' : 'danger'} />
          <Txt variant="heading" style={{ flex: 1 }}>{t(`timeIn.${problem.kind}Title`)}</Txt>
        </View>
        <Txt variant="body" color="ink2">{t(`timeIn.${problem.kind}Text`)}</Txt>

        <View style={{ backgroundColor: c.cardSoft, borderRadius: radius.control, padding: 12, gap: 8 }}>
          <Line ok={problem.gpsFound} text={!problem.gpsFound ? t('timeIn.gpsNone') : problem.inside ? t('timeIn.gpsInside') : t('timeIn.gpsOutside')} />
          {selfie && <Line ok text={t('timeIn.selfieSaved')} />}
          <Line ok={false} warn={problem.kind === 'queued'} text={problem.kind === 'queued' ? t('timeIn.willSend') : t('timeIn.notSentYet')} />
        </View>

        <View style={{ gap: 10 }}>
          {selfie && (
            <>
              <Button icon="refresh-cw" label={t('timeIn.tryAgain')} onPress={onRetry} loading={sending === 'selfie'} disabled={busy} />
              <Button kind="secondary" icon="send" label={t('timeIn.tellHr')} onPress={onTellHr} loading={sending === 'hr'} disabled={busy} />
            </>
          )}
          <Button kind="ghost" size="md" label={selfie ? t('timeIn.close') : t('timeIn.ok')} onPress={onClose} disabled={busy} />
        </View>
      </View>
    </RNModal>
  );
}
