// useWork: time in and out with Work v2. The database decides (lib/work/workApi); this hook turns each answer
// into the next step, so no failure leaves the person stuck (plan: docs/job-workflow-sketch.html):
//   no location / no GPS / outside / fake GPS → the outside sheet: map, Try again, or selfie + reason
//   no signal → saved on the phone · too early → when it opens · no job → office duty? · other phone · forgot
//   driver away from HQ → bring the vehicle back, or call the Coordinator
//   time out early (15+ min before the end) → say why; the Coordinator checks it
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { supabase } from '../supabase';
import { useT } from '../i18n';
import { WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE } from '../signIn';
import { loadHandbook } from '../handbook';
import { locateMe, tellHrCouldntTimeIn, type Spot } from '../timeIn';
import { getMyDays, reportLeftAt, uploadWorkSelfie, workTimeIn, workTimeOut, type WorkDay, type WorkResult } from './workApi';
import type { Problem } from '../useTimeIn';
import { techy } from '../../ui';

export type OutsideState = {
  open: boolean; step: 'checking' | 'done' | 'outside'; here: Spot | null; why: 'outside' | 'fake_gps' | 'no_location';
  place: { name: string; lat: number; lon: number; radius: number } | null; distance: number | null; lateMinutes: number; officeDuty: boolean;
};
const closed: OutsideState = { open: false, step: 'checking', here: null, why: 'outside', place: null, distance: null, lateMinutes: 0, officeDuty: false };
const timeText = (iso: unknown) => new Date(String(iso)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function useWork() {
  const t = useT();
  const [me, setMe] = useState<{ id: string; full_name: string | null } | null>(null);
  const [days, setDays] = useState<{ today: WorkDay | null; forgotten: WorkDay | null }>({ today: null, forgotten: null });
  const [sheet, setSheet] = useState<OutsideState>(closed);
  const [problem, setProblem] = useState<Problem>({ open: false, kind: 'notSent', gpsFound: false, inside: false });
  const [selfie, setSelfie] = useState<{ uri: string; reason: string } | null>(null);
  const [sending, setSending] = useState<'selfie' | 'hr' | null>(null);
  const [busy, setBusy] = useState(false);
  const [early, setEarly] = useState<{ endsAt: string; minutes: number } | null>(null);

  const reload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).single();
    setMe(p ?? { id: user.id, full_name: null });
    setDays(await getMyDays());
  }, []);
  useEffect(() => { reload().catch(() => {}); }, [reload]);

  const remindRules = async () => {
    try {
      const { toRead } = await loadHandbook();
      if (toRead.length) Alert.alert(t('timeIn.rulesTitle'), t('timeIn.rulesText', { n: toRead.length }), [
        { text: t('timeIn.later'), style: 'cancel' }, { text: t('timeIn.rulesOpen'), onPress: () => router.push('/handbook' as Href) },
      ]);
    } catch { /* no reminder without signal */ }
  };

  /** One place that turns every time-in answer into what happens next */
  async function handleIn(r: WorkResult, here: Spot | null, officeDuty: boolean) {
    switch (r.status) {
      case 'timed_in':
        techy.react('cheer');
        setSheet((s) => ({ ...s, open: true, step: 'done', lateMinutes: Number(r.late_minutes ?? 0) }));
        setTimeout(() => { setSheet(closed); remindRules(); }, 1800);
        return reload();
      case 'outside': case 'fake_gps': case 'need_selfie':
        return setSheet({ open: true, step: 'outside', here, officeDuty, why: r.status === 'need_selfie' ? 'no_location' : (r.status as 'outside' | 'fake_gps'),
          distance: (r.distance_m as number) ?? null, lateMinutes: 0,
          place: r.place_lat != null ? { name: String(r.place_name), lat: Number(r.place_lat), lon: Number(r.place_lon), radius: Number(r.radius_m) } : null });
      case 'queued':
        setSheet(closed); return setProblem({ open: true, kind: 'queued', gpsFound: !!here, inside: false });
      case 'already': setSheet(closed); Alert.alert(t('work.alreadyTitle'), t('work.alreadyText', { time: timeText(r.time_in) })); return reload();
      case 'forgot_time_out': setSheet(closed); return reload();
      case 'too_early': setSheet(closed); return Alert.alert(t('work.earlyTitle'), t('work.earlyText', { time: timeText(r.opens_at) }));
      case 'other_phone': setSheet(closed); return Alert.alert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
      case 'no_job':
        setSheet(closed);
        return Alert.alert(t('work.noJobTitle'), t('work.noJobText'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('work.officeDuty'), onPress: () => startTimeIn(true) },
        ]);
      default:
        setSheet(closed); return setProblem({ open: true, kind: 'notSent', gpsFound: !!here, inside: false });
    }
  }

  async function startTimeIn(officeDuty = false) {
    if (!me) return;
    setSheet({ ...closed, open: true, officeDuty });
    const found = await locateMe().catch(() => 'no_gps' as const);
    if (found === 'no_permission') {
      Alert.alert(t('timeIn.needLocationTitle'), t('timeIn.needLocationText'), [
        { text: t('work.openSettings'), onPress: () => Linking.openSettings() }, { text: t('timeIn.ok') },
      ]);
    }
    const here = typeof found === 'string' ? null : found;
    await handleIn(await workTimeIn(here, { officeDuty }), here, officeDuty);
  }

  /** Outside the site: take (or reuse) the selfie and send it with the reason picked */
  async function sendSelfie(reason: string, again = false) {
    if (!me) return;
    let uri = again ? selfie?.uri : undefined;
    if (!uri) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert(t('timeIn.cameraTitle'), t('timeIn.cameraText'));
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.3, cameraType: ImagePicker.CameraType.front });
      if (shot.canceled || !shot.assets[0]?.uri) return;
      uri = shot.assets[0].uri;
    }
    setSelfie({ uri, reason });
    setSending('selfie');
    try {
      const path = await uploadWorkSelfie(me.id, uri);
      setProblem((p) => ({ ...p, open: false }));
      await handleIn(await workTimeIn(sheet.here, { selfiePath: path, reason, officeDuty: sheet.officeDuty }), sheet.here, sheet.officeDuty);
    } catch {
      if (again) Alert.alert(t('timeIn.stillTitle'), t('timeIn.stillText'));
      setProblem({ open: true, kind: 'selfie', gpsFound: !!sheet.here, inside: false });
    } finally {
      setSending(null);
    }
  }

  async function tellHr() {
    if (!me) return;
    setSending('hr');
    const ok = await tellHrCouldntTimeIn(me, sheet.here);
    setSending(null);
    if (ok) { setProblem((p) => ({ ...p, open: false })); setSheet(closed); Alert.alert(t('timeIn.hrToldTitle'), t('timeIn.hrToldText')); }
    else Alert.alert(t('timeIn.hrFailTitle'), t('timeIn.hrFailText'));
  }

  function timeOut() {
    const day = days.today;
    if (!day) return;
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(day.time_in)) / 60000));
    Alert.alert(t('timeIn.outTitle'), t('timeIn.outText', { time: timeText(day.time_in), h: Math.floor(mins / 60), m: mins % 60 }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('timeIn.outYes'), style: 'destructive', onPress: () => sendTimeOut() },
    ]);
  }

  /** Sends the time-out (again with a reason after "early") and says what happened */
  async function sendTimeOut(reason?: string) {
    setBusy(true);
    const found = await locateMe().catch(() => 'no_gps' as const);
    const r = await workTimeOut(typeof found === 'string' ? null : found, reason);
    setBusy(false);
    if (r.status === 'early') return setEarly({ endsAt: String(r.ends_at), minutes: Number(r.minutes_early) });
    setEarly(null);
    if (r.status === 'timed_out') { techy.react('wave'); Alert.alert(t('timeIn.outDoneTitle'), t('timeIn.outDoneText', { hours: Number(r.hours) })); }
    else if (r.status === 'queued') Alert.alert(t('timeIn.queuedTitle'), t('work.outQueued'));
    else if (r.status === 'bring_vehicle_back') Alert.alert(t('work.vehicleTitle'), t('work.vehicleText', { office: String(r.office_name) }));
    else if (r.status === 'other_phone') Alert.alert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
    else if (r.status !== 'forgot_time_out') Alert.alert(t('timeIn.outFailTitle'), t('common.noSignal'));
    reload();
  }

  /** "I left at HH:MM" for a day without a time-out (HR checks it) */
  async function saveLeftAt(leftAt: Date): Promise<boolean> {
    if (!days.forgotten) return false;
    const r = await reportLeftAt(days.forgotten.id, leftAt);
    if (r.status !== 'saved') { Alert.alert(t('timeIn.outFailTitle'), t(r.status === 'bad_time' ? 'work.badLeftAt' : 'common.noSignal')); return false; }
    Alert.alert(t('forgotten.savedTitle'), t('work.leftAtSaved', { hours: Number(r.hours) }));
    await reload();
    return true;
  }

  return {
    me, days, sheet, problem, selfie, sending, busy, reload, startTimeIn, sendSelfie, tellHr, timeOut, saveLeftAt,
    early, sendTimeOut, closeEarly: () => setEarly(null),
    retry: () => startTimeIn(sheet.officeDuty),
    closeSheet: () => setSheet(closed),
    closeProblem: () => setProblem((p) => ({ ...p, open: false })),
  };
}
