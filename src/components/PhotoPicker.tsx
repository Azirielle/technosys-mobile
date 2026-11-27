// PhotoPicker: an optional photo for a concern (Andrew 27 Nov: "what if the technician sends an image?"). Take one or
// pick from the gallery (Android's photo picker: no permission needed), see it, remove it. Uploaded on send by the form.
import React from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useT } from '../lib/i18n';
import { Button, Txt, appAlert, useTokens } from '../ui';

type Props = { uri: string | null; onChange: (uri: string | null) => void };

export default function PhotoPicker({ uri, onChange }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const pick = (source: 'camera' | 'library') => async () => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!perm.granted) { appAlert(t('photoPick.title'), t('me.photoPermission')); return; }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!r.canceled && r.assets[0]?.uri) onChange(r.assets[0].uri);
  };
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{t('photoPick.title')}</Txt>
      {uri ? (
        <>
          <Image source={{ uri }} style={{ width: '100%', height: 160, borderRadius: radius.card, backgroundColor: c.cardSoft }} resizeMode="cover"
            accessibilityLabel={t('photoPick.title')} />
          <Button size="md" kind="secondary" icon="x" label={t('photoPick.remove')} onPress={() => onChange(null)} />
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Button size="md" kind="secondary" icon="camera" label={t('me.photoCamera')} onPress={pick('camera')} /></View>
          <View style={{ flex: 1 }}><Button size="md" kind="secondary" icon="image" label={t('me.photoLibrary')} onPress={pick('library')} /></View>
        </View>
      )}
    </View>
  );
}
