// What happens to a time-in / time-out saved with no signal: its selfie is kept in the app's own folder (the
// camera's copy can be cleaned up), and when it's finally sent and the database refuses it, a phone notification
// says so, so a saved punch never disappears quietly.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { translate } from '../i18n';
import { getNotifications } from '../notifications';

/** Copies the selfie somewhere it stays until it's uploaded. Returns its new address. */
export function keepSelfie(uri: string): string {
  const folder = new Directory(Paths.document, 'offline-selfies');
  if (!folder.exists) folder.create();
  const copy = new File(folder, `${Date.now()}.jpg`);
  new File(uri).copy(copy);
  return copy.uri;
}

/** Deletes a kept selfie once it's uploaded. */
export function dropSelfie(uri: string) {
  try { new File(uri).delete(); } catch { /* already gone */ }
}

const ACCEPTED = ['timed_in', 'already', 'timed_out'];
const WHY: Record<string, string> = { no_job: 'offline.whyNoJob', too_early: 'offline.whyEarly', other_phone: 'offline.whyPhone', forgot_time_out: 'offline.whyForgot' };

/** After a saved punch is sent: a notification when the database didn't accept it. */
export async function tellIfRefused(kind: 'work_time_in' | 'work_time_out', answer: { status?: string } | null, queuedAt?: string) {
  if (answer?.status && ACCEPTED.includes(answer.status)) return;
  const lang = (await AsyncStorage.getItem('@technocycle_language').catch(() => null)) ?? 'en';
  const time = queuedAt ? new Date(queuedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const t = (key: string, vars?: Record<string, string>) => translate(lang, key, vars);
  try {
    await getNotifications()?.scheduleNotificationAsync({
      content: {
        title: t(kind === 'work_time_in' ? 'offline.inRefusedTitle' : 'offline.outRefusedTitle'),
        body: t('offline.refusedText', { time, why: t(WHY[answer?.status ?? ''] ?? 'offline.whyOther') }),
      },
      trigger: null,
    });
  } catch { /* no notification possible: the DTR still shows no time-in */ }
}
