// useWork: time in and out with Work v2. The database decides (lib/work/workApi); this hook turns each answer
// into the next step, so no failure leaves the person stuck (plan: docs/job-workflow-sketch.html):
//   no location / no GPS / outside / fake GPS → the outside sheet: map, Try again, or selfie + reason
//   no signal → the phone's own check (lib/work/offlineCheck), then saved on the phone, selfie too · too early → when it opens · no job → office duty? · other phone · forgot
//   driver away from HQ → bring the vehicle back, or call the Coordinator
//   time out early (15+ min before the end) → say why; the Coordinator checks it
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { supabase } from '../supabase';
import { useT } from '../i18n';
import { WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE } from '../signIn';
import { loadHandbook } from '../handbook';
import { locateMe, tellHrCouldntTimeIn, type Spot } from '../timeIn';
import { getMyDays, myUserId, reportLeftAt, uploadWorkSelfie, workTimeIn, workTimeOut, workOfficeCheckIn, type WorkDay, type WorkResult, type OfficeCheckIn } from './workApi';
import type { Problem } from '../useTimeIn';
import { keepSelfie } from './offlineResult';
import { enroll, keepForLater, myFace, sendFaceCheck, sendOfficeFaceCheck, type FaceResult } from '../face/faceCheck';
import { techy, appAlert } from '../../ui';

export type OutsideState = {
  open: boolean; step: 'checking' | 'done' | 'outside'; here: Spot | null; why: 'outside' | 'fake_gps' | 'no_location';
  place: { name: string; lat: number; lon: number; radius: number } | null; distance: number | null; lateMinutes: number; officeDuty: boolean;
};
const closed: OutsideState = { open: false, step: 'checking', here: null, why: 'outside', place: null, distance: null, lateMinutes: 0, officeDuty: false };
const timeText = (iso: unknown) => new Date(String(iso)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function useWork() {
  const t = useT();
  const [me, setMe] = useState<{ id: string; full_name: string | null } | null>(null);
  const [days, setDays] = useState<{ today: WorkDay | null; forgotten: WorkDay | null; officeCheckIn: OfficeCheckIn | null }>({ today: null, forgotten: null, officeCheckIn: null });
  const [sheet, setSheet] = useState<OutsideState>(closed);
  const [problem, setProblem] = useState<Problem>({ open: false, kind: 'notSent', gpsFound: false, inside: false });
  const [selfie, setSelfie] = useState<{ uri: string; reason: string } | null>(null);
  const [sending, setSending] = useState<'selfie' | 'hr' | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped when the server says an earlier day is still open: Home shows that day's window again (Round 5 P1)
  const [forgotNudge, setForgotNudge] = useState(0);
  const [early, setEarly] = useState<{ endsAt: string; minutes: number } | null>(null);
  // The verified selfie after a time-in (components/face/FaceCheckSheet): for this work day, or for a saved time-in
  const [face, setFace] = useState<{ workDayId?: string; checkInId?: string; queuedAt?: string; enrolled: number[] | null } | null>(null);

  async function startFace(target: { workDayId?: string; checkInId?: string; queuedAt?: string }) {
    if (!me) return;
    setFace({ ...target, enrolled: await myFace(me.id).catch(() => null) });
  }

  /** The face step finished: send it now, or keep it with the saved time-in */
  async function faceDone(r: FaceResult | null) {
    const target = face;
    setFace(null);
    remindRules();
    if (!r || !target) return;
    if (target.workDayId) await sendFaceCheck(target.workDayId, r).catch(() => null);
    else if (target.checkInId) await sendOfficeFaceCheck(target.checkInId, r).catch(() => null);
    else if (target.queuedAt) await keepForLater(target.queuedAt, r).catch(() => {});
  }

  const reload = useCallback(async () => {
    const userId = await myUserId(); // from the phone, so Time in still works with no signal
    if (!userId) return;
    const { data: p } = await supabase.from('profiles').select('id, full_name').eq('id', userId).single();
    setMe(p ?? { id: userId, full_name: null });
    setDays(await getMyDays());
  }, []);
  useEffect(() => { reload().catch(() => {}); }, [reload]);

  const remindRules = async () => {
    try {
      const { toRead } = await loadHandbook();
      if (toRead.length) appAlert(t('timeIn.rulesTitle'), t('timeIn.rulesText', { n: toRead.length }), [
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
        setTimeout(() => {
          setSheet(closed);
          if (!r.face_already_checked) startFace({ workDayId: String(r.work_day_id) });
        }, 1800);
        return reload();
      case 'outside': case 'fake_gps': case 'need_selfie':
        return setSheet({ open: true, step: 'outside', here, officeDuty, why: r.status === 'need_selfie' ? 'no_location' : (r.status as 'outside' | 'fake_gps'),
          distance: (r.distance_m as number) ?? null, lateMinutes: 0,
          place: r.place_lat != null ? { name: String(r.place_name), lat: Number(r.place_lat), lon: Number(r.place_lon), radius: Number(r.radius_m) } : null });
      case 'queued':
        setSheet(closed);
        if (r.queued_at) startFace({ queuedAt: String(r.queued_at) });
        reload().catch(() => {}); // the card shows the saved time-in as timed in, waiting to send
        return setProblem({ open: true, kind: 'queued', gpsFound: !!here, inside: false });
      case 'in_house': setSheet(closed); return appAlert(t('jobs.inHouse'), t('home.inHouseNote'));
      case 'already': setSheet(closed); appAlert(t('work.alreadyTitle'), t('work.alreadyText', { time: timeText(r.time_in) })); return reload();
      case 'forgot_time_out': setSheet(closed); setForgotNudge((n) => n + 1); return reload();
      case 'too_early': setSheet(closed); return appAlert(t('work.tooEarlyTitle'), t('work.tooEarlyText', { time: timeText(r.opens_at) }));
      case 'other_phone': setSheet(closed); return appAlert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
      case 'no_job':
        setSheet(closed);
        return appAlert(t('work.noJobTitle'), t('work.noJobText'), [
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
      appAlert(t('timeIn.needLocationTitle'), t('timeIn.needLocationText'), [
        { text: t('work.openSettings'), onPress: () => Linking.openSettings() }, { text: t('timeIn.ok') },
      ]);
    }
    const here = typeof found === 'string' ? null : found;
    await handleIn(await workTimeIn(here, { officeDuty }), here, officeDuty);
  }

  /** Check in at Pacita office before leaving for the on-site job */
  async function startOfficeCheckIn() {
    if (!me) return;
    setBusy(true);
    const found = await locateMe().catch(() => 'no_gps' as const);
    const here = typeof found === 'string' ? null : found;
    const r = await workOfficeCheckIn(here);
    setBusy(false);
    if (r.status === 'checked_in') {
      techy.react('cheer');
      appAlert(t('home.checkedInOfficeTitle'), t('home.checkedInOfficeMsg'));
      await reload();
      if (r.check_in_id) startFace({ checkInId: String(r.check_in_id) });
    } else if (r.status === 'queued') {
      if (r.queued_at) startFace({ queuedAt: String(r.queued_at) });
      setProblem({ open: true, kind: 'queued', gpsFound: !!here, inside: false });
    } else if (r.status === 'outside') {
      appAlert(t('home.outsideOfficeTitle'), t('home.outsideOfficeMsg', { distance: r.distance_m != null ? String(r.distance_m) : '—' }));
    } else if (r.status === 'already') {
      appAlert(t('home.alreadyOfficeTitle'), t('home.alreadyOfficeMsg'));
      reload();
    } else {
      appAlert(t('common.error'), String(r.message ?? t('timeIn.tryAgain')));
    }
  }

  /** Outside the site: take (or reuse) the selfie and send it with the reason picked */
  async function sendSelfie(reason: string, again = false) {
    if (!me) return;
    let uri = again ? selfie?.uri : undefined;
    if (!uri) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return appAlert(t('timeIn.cameraTitle'), t('timeIn.cameraText'));
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.3, cameraType: ImagePicker.CameraType.front });
      if (shot.canceled || !shot.assets[0]?.uri) return;
      uri = shot.assets[0].uri;
    }
    setSelfie({ uri, reason });
    setSending('selfie');
    try {
      const path = await uploadWorkSelfie(me.id, uri).catch((e) => {
        if (!/fetch|network|timeout/i.test(String(e?.message ?? e))) throw e;
        return null; // no signal: the selfie is kept on the phone and goes with the saved time-in
      });
      setProblem((p) => ({ ...p, open: false }));
      const extra = path ? { selfiePath: path } : { selfieUri: keepSelfie(uri) };
      await handleIn(await workTimeIn(sheet.here, { ...extra, reason, officeDuty: sheet.officeDuty }), sheet.here, sheet.officeDuty);
    } catch {
      if (again) appAlert(t('timeIn.stillTitle'), t('timeIn.stillText'));
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
    if (ok) { setProblem((p) => ({ ...p, open: false })); setSheet(closed); appAlert(t('timeIn.hrToldTitle'), t('timeIn.hrToldText')); }
    else appAlert(t('timeIn.hrFailTitle'), t('timeIn.hrFailText'));
  }

  function timeOut() {
    const day = days.today;
    if (!day) return;
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(day.time_in)) / 60000));
    appAlert(t('timeIn.outTitle'), t('timeIn.outText', { time: timeText(day.time_in), h: Math.floor(mins / 60), m: mins % 60 }), [
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
    if (r.status === 'timed_out') { techy.react('wave'); appAlert(t('timeIn.outDoneTitle'), t('timeIn.outDoneText', { hours: Number(r.hours) })); }
    else if (r.status === 'queued') appAlert(t('timeIn.queuedTitle'), t('work.outQueued'));
    else if (r.status === 'bring_vehicle_back') appAlert(t('work.vehicleTitle'), t('work.vehicleText', { office: String(r.office_name) }));
    else if (r.status === 'other_phone') appAlert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE);
    else if (r.status !== 'forgot_time_out') appAlert(t('timeIn.outFailTitle'), t('common.noSignal'));
    reload();
  }

  /** "I left at HH:MM" for a day without a time-out (HR checks it) */
  async function saveLeftAt(leftAt: Date): Promise<boolean> {
    if (!days.forgotten) return false;
    const r = await reportLeftAt(days.forgotten.id, leftAt);
    if (r.status !== 'saved') { appAlert(t('timeIn.outFailTitle'), t(r.status === 'bad_time' ? 'work.badLeftAt' : 'common.noSignal')); return false; }
    appAlert(t('forgotten.savedTitle'), t('work.leftAtSaved', { hours: Number(r.hours) }));
    await reload();
    return true;
  }

  return {
    me, days, sheet, problem, selfie, sending, busy, forgotNudge, reload, startTimeIn, startOfficeCheckIn, sendSelfie, tellHr, timeOut, saveLeftAt,
    early, sendTimeOut, closeEarly: () => setEarly(null),
    face, faceDone, enrollFace: (uri: string, numbers: number[]) => (me ? enroll(me.id, uri, numbers) : Promise.reject(new Error('signed out'))),
    retry: () => startTimeIn(sheet.officeDuty),
    closeSheet: () => setSheet(closed),
    closeProblem: () => setProblem((p) => ({ ...p, open: false })),
  };
}
