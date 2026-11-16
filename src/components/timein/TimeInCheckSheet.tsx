// TimeInCheckSheet: the dialog that opens when you tap Time in. It shows "finding you", then either
// "timed in" or, outside the site, how far you are, the site on a map, Navigate, and "Take a selfie".
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import RNModal from 'react-native-modal';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { metersBetween } from '../../lib/timeIn';
import type { CheckState } from '../../lib/useTimeIn';
import MapView, { Circle, Marker } from '../MapWrapper';
import NavigateButton from '../NavigateButton';
import { Button, SuccessCheck, Txt, useTokens } from '../../ui';

type Props = { check: CheckState; address?: string | null; sending: boolean; onSelfie: () => void; onClose: () => void };

const distanceText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

export default function TimeInCheckSheet({ check, address, sending, onSelfie, onClose }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const { here, site } = check;
  const meters = here && site ? metersBetween(here, site) : null;

  return (
    <RNModal isVisible={check.open} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
      onBackdropPress={onClose} onBackButtonPress={onClose} style={{ margin: 0, justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: c.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 20, paddingBottom: 32 }}>
        {check.step === 'checking' && (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 14 }}>
            <ActivityIndicator size="large" color={c.brand} />
            <Txt variant="heading">{t('timeIn.checking')}</Txt>
          </View>
        )}

        {check.step === 'done' && (
          <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <SuccessCheck size={64} />
            <Txt variant="heading" color="ok">{t('timeIn.verified')}</Txt>
          </View>
        )}

        {check.step === 'outside' && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Txt variant="title" style={{ flex: 1, fontSize: 20 }}>{t('timeIn.outsideTitle')}</Txt>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
                <Feather name="x" size={24} color={c.ink2} />
              </Pressable>
            </View>
            <Txt variant="body" color="ink2">
              {site && meters != null ? t('timeIn.outsideText', { distance: distanceText(meters), site: site.name }) : t('timeIn.outsideNoSite')}
            </Txt>

            {here && site && (
              <View style={{ height: 220, borderRadius: radius.card, overflow: 'hidden', backgroundColor: c.cardSoft }}>
                <MapView style={{ flex: 1 }} initialRegion={{
                  latitude: (here.lat + site.lat) / 2, longitude: (here.lon + site.lon) / 2,
                  latitudeDelta: Math.max(Math.abs(here.lat - site.lat) * 2.2, 0.008),
                  longitudeDelta: Math.max(Math.abs(here.lon - site.lon) * 2.2, 0.008),
                }}>
                  <Circle center={{ latitude: site.lat, longitude: site.lon }} radius={site.radius} strokeColor={c.ok} fillColor={c.okBg} strokeWidth={2} />
                  <Marker coordinate={{ latitude: site.lat, longitude: site.lon }} title={site.name} pinColor={c.ok} />
                  <Marker coordinate={{ latitude: here.lat, longitude: here.lon }} title={t('timeIn.you')} pinColor={c.error} />
                </MapView>
                <NavigateButton lat={site.lat} lon={site.lon} address={address ?? undefined} color={c.brand} label={t('jobs.navigate')} />
              </View>
            )}

            <Button icon="camera" label={t('timeIn.takeSelfie')} onPress={onSelfie} loading={sending} />
          </View>
        )}
      </View>
    </RNModal>
  );
}
