// faceCheck: the verified selfie on every time-in (CONSULTATION_FIXES B15). Your enrolled face (128 numbers) is kept on
// the phone too, so the match works with no signal. After time_in says "timed_in", the selfie is uploaded and
// record_face_check saves the score; the database marks a low score "Face mismatch - needs review" (it never blocks).
// A time-in saved with no signal keeps its face result here until the saved time-in is sent (lib/syncQueue).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { uploadPhoto } from '../photoUpload';
import { dropSelfie, keepSelfie } from '../work/offlineResult';

export type FaceResult = { uri: string; score: number; live: boolean };
const faceKey = (uid: string) => `FACE_NUMBERS_${uid}`;
const PENDING_KEY = 'FACE_PENDING'; // { [queued_at]: FaceResult }

/** Your enrolled face from the database (kept on the phone for no signal). null = not enrolled, or HR reset it. */
export async function myFace(uid: string): Promise<number[] | null> {
  const { data, error } = await supabase.from('face_enrollments').select('embedding').eq('person_id', uid).maybeSingle();
  if (error) { // no signal: the copy on the phone
    const saved = await AsyncStorage.getItem(faceKey(uid)).catch(() => null);
    return saved ? JSON.parse(saved) : null;
  }
  if (!data) { await AsyncStorage.removeItem(faceKey(uid)).catch(() => {}); return null; }
  await AsyncStorage.setItem(faceKey(uid), JSON.stringify(data.embedding)).catch(() => {});
  return data.embedding as number[];
}

/** Saves your face once (needs signal). Throws when it couldn't. */
export async function enroll(uid: string, uri: string, face: number[]) {
  const path = `${uid}-enroll-${Date.now()}.jpg`;
  await uploadPhoto('dtr-selfies', path, uri);
  const { error } = await supabase.from('face_enrollments').insert({ person_id: uid, embedding: face, photo_path: path });
  if (error) throw error;
  await AsyncStorage.setItem(faceKey(uid), JSON.stringify(face)).catch(() => {});
}

/** Uploads the selfie and saves the result on the work day. Returns the database's face_check, or null if it failed. */
export async function sendFaceCheck(workDayId: string, r: FaceResult): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const path = `${session.user.id}-face-${Date.now()}.jpg`;
  await uploadPhoto('dtr-selfies', path, r.uri);
  const { data, error } = await supabase.rpc('record_face_check', { p_work_day_id: workDayId, p_selfie_path: path, p_score: r.score, p_live: r.live });
  const answer = data as { status?: string; face_check?: string } | null;
  return error ? null : (answer?.face_check ?? answer?.status ?? 'done');
}

/** No signal: keep the face result with the saved time-in (by the time it was taken). */
export async function keepForLater(queuedAt: string, r: FaceResult) {
  const all = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? '{}');
  all[queuedAt] = { ...r, uri: r.uri ? keepSelfie(r.uri) : '' };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(all));
}

/** No face found or no head turns (Round 6): the work day is flagged for the Coordinator instead. */
export const NO_FACE: FaceResult = { uri: '', score: 0, live: false };
export async function flagNoFace(workDayId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('flag_no_face_check', { p_work_day_id: workDayId });
  return error ? null : ((data as { status?: string } | null)?.status ?? 'done');
}

/** The saved time-in was accepted: send its face result. A failure here is kept for the next try. */
export async function sendKeptFace(queuedAt: string, workDayId: string) {
  const all = JSON.parse((await AsyncStorage.getItem(PENDING_KEY).catch(() => null)) ?? '{}');
  const r: FaceResult | undefined = all[queuedAt];
  if (!r) return;
  const sent = r.uri ? await sendFaceCheck(workDayId, r).catch(() => null) : await flagNoFace(workDayId).catch(() => null);
  if (sent === null) return;
  if (r.uri) dropSelfie(r.uri);
  delete all[queuedAt];
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(all));
}
