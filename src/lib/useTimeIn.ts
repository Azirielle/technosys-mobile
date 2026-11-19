// useTimeIn: the steps of timing in and out on Home, and what the three time-in dialogs show.
//   Time in: find you → inside the site: save (or keep on the phone with no signal) → outside: selfie for HR.
//   Time out: confirm → save. A shift from an earlier day without a time-out asks "When did you leave?".
// Saving is done by lib/timeIn.ts and lib/forgottenShift.ts; the dialogs are in components/timein/.
import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { supabase } from './supabase';
import { useT } from './i18n';
import { isWrongPhoneError, WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE } from './signIn';
import { loadHandbook } from './handbook';
import { findSite, getTodayShift, locateMe, metersBetween, queueTimeIn, saveTimeIn, saveTimeOut, tellHrCouldntTimeIn, uploadSelfie, Site, ShiftLog, Spot } from './timeIn';
import { findForgottenShift, closeForgottenShift } from './forgottenShift';
import type { HomeJob } from './jobs';
import { techy, appAlert } from '../ui';

type Me = { id: string; full_name: string | null };
export type CheckState = { open: boolean; step: 'checking' | 'done' | 'outside'; here: Spot | null; site: Site | null };
export type Problem = { open: boolean; kind: 'queued' | 'notSent' | 'selfie'; gpsFound: boolean; inside: boolean };

export function useTimeIn(job: HomeJob | null) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [shift, setShift] = useState<{ active: ShiftLog | null; done: ShiftLog | null }>({ active: null, done: null });
  const [timingOut, setTimingOut] = useState(false);
  const [check, setCheck] = useState<CheckState>({ open: false, step: 'checking', here: null, site: null });
  const [problem, setProblem] = useState<Problem>({ open: false, kind: 'notSent', gpsFound: false, inside: false });
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [sending, setSending] = useState<'selfie' | 'hr' | null>(null);
  const [forgotten, setForgotten] = useState<ShiftLog | null>(null);

  const reload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('id', user.id).single();
    setMe(profile ?? { id: user.id, full_name: null });
    setShift(await getTodayShift(user.id));
    return user.id;
  }, []);

  // First load: today's shift, and a shift from an earlier day that was never timed out
  useEffect(() => {
    reload().then((id) => { if (id) findForgottenShift(id).then(setForgotten).catch(() => {}); }).catch(() => {});
  }, [reload]);

  const remindRules = async () => {
    try {
      const { toRead } = await loadHandbook();
      if (!toRead.length) return;
      appAlert(t('timeIn.rulesTitle'), t('timeIn.rulesText', { n: toRead.length }), [
        { text: t('timeIn.later'), style: 'cancel' },
        { text: t('timeIn.rulesOpen'), onPress: () => router.push('/handbook' as Href) },
      ]);
    } catch {
      // no reminder without signal
    }
  };

  const timedIn = (log: ShiftLog) => { techy.react('cheer'); setShift({ active: log, done: null }); };
  const closeAll = () => { setCheck((c) => ({ ...c, open: false })); setProblem((p) => ({ ...p, open: false })); };
  const wrongPhone = () => { closeAll(); appAlert(WRONG_PHONE_TITLE, WRONG_PHONE_MESSAGE); };

  async function startTimeIn() {
    if (!me) return;
    if (shift.active) { appAlert(t('timeIn.alreadyTitle'), t('timeIn.alreadyText')); return; }
    setSelfieUri(null);
    setCheck({ open: true, step: 'checking', here: null, site: null });
    let here: Spot | null = null;
    try {
      const found = await locateMe();
      if (found === 'no_permission' || found === 'no_gps') {
        appAlert(t(`timeIn.${found === 'no_gps' ? 'noGps' : 'needLocation'}Title`), t(`timeIn.${found === 'no_gps' ? 'noGps' : 'needLocation'}Text`));
        setCheck({ open: true, step: 'outside', here: null, site: await findSite(job, null) });
        return;
      }
      const site = await findSite(job, found);
      setCheck({ open: true, step: 'checking', here: found, site });
      if (found.isMocked) {
        appAlert(t('timeIn.mockTitle'), t('timeIn.mockText'));
        setCheck({ open: true, step: 'outside', here: found, site });
        return;
      }
      if (!site || metersBetween(found, site) > site.radius) { setCheck({ open: true, step: 'outside', here: found, site }); return; }
      here = found;
      const log = await saveTimeIn(me, found);
      setCheck({ open: true, step: 'done', here: found, site });
      timedIn(log);
      setTimeout(() => { setCheck((c) => ({ ...c, open: false })); remindRules(); }, 1800);
    } catch (err) {
      if (isWrongPhoneError(err)) return wrongPhone();
      const queued = here ? await queueTimeIn(me, here) : false;
      setCheck((c) => ({ ...c, step: 'outside' }));
      setProblem({ open: true, kind: queued ? 'queued' : 'notSent', gpsFound: !!here, inside: !!here });
    }
  }

  /** Outside the site: the selfie is kept on the phone, so "Try again" sends the same one. */
  async function sendSelfie(again = false) {
    if (!me) return;
    let uri = again ? selfieUri : null;
    if (!uri) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { appAlert(t('timeIn.cameraTitle'), t('timeIn.cameraText')); return; }
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.3, cameraType: ImagePicker.CameraType.front });
      if (shot.canceled || !shot.assets[0]?.uri) return;
      uri = shot.assets[0].uri;
      setSelfieUri(uri);
    }
    setSending('selfie');
    try {
      const path = await uploadSelfie(me.id, uri);
      const log = await saveTimeIn(me, check.here, path);
      closeAll();
      timedIn(log);
      appAlert(t('timeIn.sentTitle'), t('timeIn.sentText'));
      remindRules();
    } catch (err) {
      if (isWrongPhoneError(err)) return wrongPhone();
      if (again) appAlert(t('timeIn.stillTitle'), t('timeIn.stillText'));
      setProblem({ open: true, kind: 'selfie', gpsFound: !!check.here, inside: false });
    } finally {
      setSending(null);
    }
  }

  async function tellHr() {
    if (!me) return;
    setSending('hr');
    const ok = await tellHrCouldntTimeIn(me, check.here);
    setSending(null);
    if (ok) { closeAll(); appAlert(t('timeIn.hrToldTitle'), t('timeIn.hrToldText')); }
    else appAlert(t('timeIn.hrFailTitle'), t('timeIn.hrFailText'));
  }

  function timeOut() {
    const log = shift.active;
    if (!log || !me) return;
    const mins = Math.max(0, Math.floor((Date.now() - Date.parse(log.app_time_in)) / 60000));
    const started = new Date(log.app_time_in).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    appAlert(t('timeIn.outTitle'), t('timeIn.outText', { time: started, h: Math.floor(mins / 60), m: mins % 60 }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('timeIn.outYes'), style: 'destructive', onPress: async () => {
          setTimingOut(true);
          try {
            const { timeOut: at, hours } = await saveTimeOut(me, log);
            setShift({ active: null, done: { ...log, app_time_out: at, total_hours: hours } });
            techy.react('wave');
            appAlert(t('timeIn.outDoneTitle'), t('timeIn.outDoneText', { hours }));
          } catch {
            appAlert(t('timeIn.outFailTitle'), t('common.noSignal'));
          } finally {
            setTimingOut(false);
          }
        },
      },
    ]);
  }

  /** "I left at HH:MM" for a forgotten shift. Returns false if it couldn't be saved. */
  async function saveForgotten(time: string): Promise<boolean> {
    if (!forgotten || !me) return false;
    const saved = await closeForgottenShift(me, forgotten, time);
    if (!saved) { appAlert(t('timeIn.outFailTitle'), t('common.noSignal')); return false; }
    const day = new Date(forgotten.app_time_in).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    setForgotten(null);
    appAlert(t('forgotten.savedTitle'), t('forgotten.savedText', { date: day, time, hours: saved.hours }));
    return true;
  }

  return {
    me, shift, timingOut, check, problem, selfieUri, sending, forgotten,
    reload, startTimeIn, sendSelfie, tellHr, timeOut, saveForgotten,
    closeCheck: () => setCheck((c) => ({ ...c, open: false })),
    closeProblem: () => setProblem((p) => ({ ...p, open: false })),
    laterForgotten: () => setForgotten(null),
  };
}
