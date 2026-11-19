// WorkCheckSheet (Work v2): the dialog after tapping Time in. "Finding you" → "Timed in" (with late minutes),
// or, when the database couldn't confirm the site: why (outside / fake GPS / no location), the map with the
// circle and Navigate, Try again, and a selfie with a reason (saved as "needs review").
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import RNModal from 'react-native-modal';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import type { OutsideState } from '../../lib/work/useWork';
import MapView, { Circle, Marker } from '../MapWrapper';
import NavigateButton from '../NavigateButton';
import { Button, ChoiceCard, SuccessCheck, TextBox, Txt, useTokens } from '../../ui';

type Props = { sheet: OutsideState; sending: boolean; onRetry: () => void; onSelfie: (reason: string) => void; onClose: () => void };
const REASONS = ['indoors', 'moved', 'other'] as const;
const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default function WorkCheckSheet({ sheet, sending, onRetry, onSelfie, onClose }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const [reason, setReason] = useState<(typeof REASONS)[number]>(sheet.why === 'no_location' ? 'other' : 'indoors');
  const [other, setOther] = useState('');
  const { here, place } = sheet;
  const text = reason === 'other' ? other.trim() : t(`work.reason_${reason}`);

  return (
    <RNModal isVisible={sheet.open} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={sending ? undefined : onClose} onBackButtonPress={sending ? undefined : onClose} style={{ margin: 0, justifyContent: 'flex-end' }}>
      <KeyboardAvoidingView behavior="padding">
      <View style={{ backgroundColor: c.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 20, paddingBottom: 32, maxHeight: '92%' }}>
        {sheet.step === 'checking' && (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 14 }}>
            <ActivityIndicator size="large" color={c.brand} />
            <Txt variant="heading">{t('timeIn.checking')}</Txt>
          </View>
        )}

        {sheet.step === 'done' && (
          <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
            <SuccessCheck size={64} />
            <Txt variant="heading" color="ok">{t('work.timedIn')}</Txt>
            {sheet.lateMinutes > 0 && <Txt variant="body" color="pending">{t('work.lateBy', { m: sheet.lateMinutes })}</Txt>}
          </View>
        )}

        {sheet.step === 'outside' && (
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Txt variant="title" style={{ flex: 1, fontSize: 20 }}>{t(`work.why_${sheet.why}`)}</Txt>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
                <Feather name="x" size={24} color={c.ink2} />
              </Pressable>
            </View>
            <Txt variant="body" color="ink2">
              {place && sheet.distance != null ? t('work.distance', { distance: km(sheet.distance), place: place.name }) : t(`work.whyText_${sheet.why}`)}
            </Txt>

            {here && place && (
              <View style={{ height: 200, borderRadius: radius.card, overflow: 'hidden', backgroundColor: c.cardSoft }}>
                <MapView style={{ flex: 1 }} initialRegion={{
                  latitude: (here.lat + place.lat) / 2, longitude: (here.lon + place.lon) / 2,
                  latitudeDelta: Math.max(Math.abs(here.lat - place.lat) * 2.2, 0.008), longitudeDelta: Math.max(Math.abs(here.lon - place.lon) * 2.2, 0.008),
                }}>
                  <Circle center={{ latitude: place.lat, longitude: place.lon }} radius={place.radius} strokeColor={c.ok} fillColor={c.okBg} strokeWidth={2} />
                  <Marker coordinate={{ latitude: place.lat, longitude: place.lon }} title={place.name} pinColor={c.ok} />
                  <Marker coordinate={{ latitude: here.lat, longitude: here.lon }} title={t('timeIn.you')} pinColor={c.error} />
                </MapView>
                <NavigateButton lat={place.lat} lon={place.lon} color={c.brand} label={t('jobs.navigate')} />
              </View>
            )}

            <Button kind="secondary" icon="refresh-cw" label={t('work.tryAgain')} onPress={onRetry} disabled={sending} />

            <Txt variant="label" style={{ marginTop: 4 }}>{t('work.orSelfie')}</Txt>
            {REASONS.map((r) => (
              <ChoiceCard key={r} title={t(`work.reason_${r}`)} selected={reason === r} onPress={() => setReason(r)} />
            ))}
            {reason === 'other' && <TextBox label={t('work.reasonLabel')} value={other} onChangeText={setOther} placeholder={t('work.reasonPlaceholder')} maxLength={200} />}
            <Button icon="camera" label={t('work.selfieAndTimeIn')} onPress={() => onSelfie(text)} loading={sending} disabled={text.length < 3} />
            <Txt variant="caption" color="ink2" center>{t('work.reviewNote')}</Txt>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
    </RNModal>
  );
}
