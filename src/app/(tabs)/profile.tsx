// Profile tab (was "Me"), laid out like a phone's Settings: your photo and name, then General (notifications,
// appearance, language), Security (handbook and forms, work phone) and Sign out. Grey icon squares, the current
// value before each arrow; Appearance and Language open their own screen; Vibrate on tap is a switch.
// Nothing from Home is repeated here.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useNavigation, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { useT } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { getMyProfile, countPoliciesToRead, initials, prettyMobile, MyProfile } from '../../lib/profile';
import { changeAvatar } from '../../lib/avatar';
import { getPermissionStates, openPhoneSettings, requestMissingPermissions, PermissionState } from '../../lib/permissions';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { jobTitle } from '../../lib/jobTitle';
import { getDeviceName } from '../../lib/deviceId';
import { loadHapticsSetting, saveHapticsSetting } from '../../lib/hapticsSetting';
import { startTechyTour } from '../../components/tour/TechyTour';
import { biometricAvailable, biometricOn, getRemembered, turnBiometricOff } from '../../lib/quickSignIn';
import { Card, ConfirmDialog, ListRow, SectionLabel, SkeletonRow, TAB_BAR_HEIGHT, Toggle, Txt, arrive, tourTarget, haptic, useReducedMotion, useTokens } from '../../ui';

const AVATAR = 64;

export default function ProfileTab() {
  const t = useT();
  const { c, space } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { themeMode, language } = useAppTheme();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [toRead, setToRead] = useState(0);
  const [notif, setNotif] = useState<PermissionState>('undetermined');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [buzz, setBuzz] = useState(true);
  useEffect(() => { loadHapticsSetting().then(setBuzz); }, []);
  const changeBuzz = (on: boolean) => { setBuzz(on); saveHapticsSetting(on).then(() => { if (on) haptic.tap(); }); };
  // Fingerprint sign-in: only for PIN sign-ins on a phone that has a fingerprint or face set up
  const [bio, setBio] = useState({ can: false, on: false });
  const refreshBio = () => { Promise.all([biometricAvailable(), biometricOn(), getRemembered()]).then(([a, on, who]) => setBio({ can: a && !!who, on })); };
  const changeBio = (on: boolean) => { if (on) router.push('/change-pin?fingerprint=1' as Href); else turnBiometricOff().then(refreshBio); };

  const refreshNotif = useCallback(() => { getPermissionStates().then((s) => setNotif(s.notifications)).catch(() => {}); }, []);
  useFocusRefresh(() => {
    getMyProfile().then(async (p) => {
      if (!p) return;
      setProfile(p);
      setToRead(await countPoliciesToRead(p.id).catch(() => 0));
    }).catch(() => {});
    refreshNotif();
    refreshBio();
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshNotif(); });
    return () => sub.remove();
  }, [refreshNotif]);

  const pickPhoto = () => Alert.alert(t('me.photoTitle'), undefined, [
    { text: t('me.photoCamera'), onPress: () => savePhoto('camera') },
    { text: t('me.photoLibrary'), onPress: () => savePhoto('library') },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
  const savePhoto = async (source: 'camera' | 'library') => {
    setSavingPhoto(true);
    const r = await changeAvatar(source);
    setSavingPhoto(false);
    if (r.ok) { haptic.success(); setProfile((p) => (p ? { ...p, avatar_url: r.url } : p)); }
    else if (r.reason === 'permission') Alert.alert(t('me.photoTitle'), t('me.photoPermission'));
    else if (r.reason === 'failed') Alert.alert(t('me.photoTitle'), t('common.noSignal'));
  };

  const notifValue = notif === 'granted' ? t('me.notifOn') : notif === 'unavailable' ? t('profile.notifApk') : t('profile.notifOff');
  const onNotif = async () => {
    if (notif === 'undetermined') { await requestMissingPermissions(); refreshNotif(); }
    else if (notif === 'denied') openPhoneSettings();
  };
  const themeValue = { light: t('me.light'), dark: t('me.dark'), system: t('me.system') }[themeMode];
  const navigation = useNavigation();
  const [askSignOut, setAskSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // By name, not router.replace('/'): inside the tabs "/" is the Home tab, so that landed on Home still open
  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut().catch(() => {});
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'index' as never }] });
  };
  const isFieldStaff = !profile || ['technician', 'helper'].includes(profile.role);
  const group = { paddingVertical: 6 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}>
        <Txt variant="heading" accessibilityRole="header" style={{ textAlign: 'center', paddingVertical: 12 }}>{t('tabs.profile')}</Txt>

        <Animated.View entering={arrive(0, reduced)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable onPress={pickPhoto} disabled={savingPhoto} accessibilityRole="button" accessibilityLabel={t('me.photoTitle')}>
              <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', opacity: savingPhoto ? 0.5 : 1 }}>
                {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: AVATAR, height: AVATAR }} />
                  : <Txt variant="heading" color="brand" style={{ fontSize: 22 }}>{initials(profile?.full_name)}</Txt>}
              </View>
              <View style={{ position: 'absolute', right: -3, bottom: -3, width: 26, height: 26, borderRadius: 13, backgroundColor: c.brand, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="camera" size={12} color={c.onBrand} />
              </View>
            </Pressable>
            {profile ? (
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading" numberOfLines={1}>{profile.full_name}</Txt>
                <Txt variant="caption" color="ink2" numberOfLines={1}>{jobTitle(profile)}</Txt>
                {!!profile.contact_number && <Txt variant="caption" color="ink2">{prettyMobile(profile.contact_number)}</Txt>}
              </View>
            ) : <View style={{ flex: 1 }}><SkeletonRow /></View>}
          </Card>

          <SectionLabel>{t('me.general')}</SectionLabel>
          <Card padded={false} style={group}>
            <ListRow look="settings" icon="bell" title={t('me.notifications')} value={notifValue}
              onPress={notif === 'undetermined' || notif === 'denied' ? onNotif : undefined} />
            <ListRow look="settings" icon="sun" title={t('me.appearance')} value={themeValue} onPress={() => router.push('/settings-choice?kind=appearance' as Href)} />
            <View ref={tourTarget('profile-language')} collapsable={false}>
              <ListRow look="settings" icon="globe" title={t('me.language')} value={language === 'tl' ? 'Filipino' : 'English'} onPress={() => router.push('/settings-choice?kind=language' as Href)} />
            </View>
            <ListRow look="settings" icon="activity" title={t('profile.haptics')} subtitle={t('profile.hapticsSub')}
              right={<Toggle value={buzz} onChange={changeBuzz} label={t('profile.haptics')} />} />
          </Card>

          <SectionLabel>{t('me.security')}</SectionLabel>
          <Card padded={false} style={group}>
            <ListRow look="settings" icon="book-open" title={t('me.handbook')} value={toRead > 0 ? t('me.toRead', { n: toRead }) : undefined}
              onPress={() => router.push('/handbook' as Href)} />
            {isFieldStaff && <ListRow look="settings" icon="smartphone" title={t('me.phone')} value={getDeviceName()} />}
            {isFieldStaff && <ListRow look="settings" icon="lock" title={t('pin.changeTitle')} onPress={() => router.push('/change-pin' as Href)} />}
            {isFieldStaff && bio.can && <ListRow look="settings" icon="unlock" title={t('pin.bioTitle')}
              right={<Toggle value={bio.on} onChange={changeBio} label={t('pin.bioTitle')} />} />}
            {isFieldStaff && <View ref={tourTarget('profile-replay')} collapsable={false}><ListRow look="settings" icon="play-circle" title={t('tour.replay')} onPress={startTechyTour} /></View>}
          </Card>

          <Card padded={false} style={[group, { marginTop: 22 }]}>
            <ListRow look="settings" danger icon="log-out" title={t('me.signOut')} onPress={() => setAskSignOut(true)} />
          </Card>
          <ConfirmDialog open={askSignOut} title={t('me.signOutTitle')} text={t('me.signOutText')} confirmLabel={t('me.signOut')}
            cancelLabel={t('common.cancel')} busy={signingOut} onConfirm={signOut} onCancel={() => setAskSignOut(false)} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
