// First-time setup on a phone: which steps are still left, and saving the app-rules agreement.
// Steps, in order: language → app rules (Terms + Privacy) → this phone (field staff) → your own PIN (field staff,
// while the PIN is still HR's temporary one) → permissions → your face (technicians with no saved face).
// After setup, Techy's tour plays once on Home for field staff (isTourDue, components/tour/TechyTour.tsx).
// It shows once per person per phone; later only the part that changed comes back
// (a new version of the app rules, a new phone after HR approval or a reinstall).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { supabase } from './supabase';
import { checkThisPhone } from './signIn';
import { myPinIsOwn } from './quickSignIn';
import { myFace } from './face/faceCheck';
import type { CompanyPolicy } from '../components/PolicyReaderModal';

export type SetupStep = 'language' | 'rules' | 'phone' | 'pin' | 'permissions' | 'face';
const ORDER: SetupStep[] = ['language', 'rules', 'phone', 'pin', 'permissions', 'face'];

const LANGUAGE_DONE = 'setup_language_done';
const permissionsKey = (userId: string) => `setup_permissions_done_${userId}`;
// Techy's tour ('main', on Home after setup) and its first-visit tips ('inbox', 'profile'): once per person per phone
const tourKey = (userId: string, name: TourName) => (name === 'main' ? `setup_tour_done_${userId}` : `tour_tip_${name}_${userId}`);
export type TourName = 'main' | 'inbox' | 'profile';

/** The two app rules every user agrees to once: the newest Terms of use and Privacy notice. */
export async function loadAppRules(): Promise<CompanyPolicy[]> {
  const { data, error } = await supabase
    .from('policies')
    .select('*')
    .eq('is_active', true)
    .or('id.like.terms_of_service%,id.like.privacy_policy%')
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  // Newest active version of each
  const terms = (data ?? []).find(p => p.id.startsWith('terms_of_service'));
  const privacy = (data ?? []).find(p => p.id.startsWith('privacy_policy'));
  return [terms, privacy].filter(Boolean) as unknown as CompanyPolicy[];
}

async function hasAgreedToRules(userId: string): Promise<boolean> {
  const rules = await loadAppRules();
  if (rules.length === 0) return true; // nothing to agree to
  const { data, error } = await supabase
    .from('policy_acknowledgments')
    .select('policy_id, policy_version')
    .eq('user_id', userId)
    .in('policy_id', rules.map(r => r.id));
  if (error) throw error;
  return rules.every(r => (data ?? []).some(a => a.policy_id === r.id && a.policy_version === r.version));
}

/** Records "I agree" for each app rule (HR sees it in Policies → Signatures). */
export async function agreeToRules(rules: CompanyPolicy[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const userAgent = `TechnoSys Mobile (${Platform.OS}; ${Device.modelName || 'Phone'}) · first-time setup`;
  const { error } = await supabase.from('policy_acknowledgments').upsert(
    rules.map(r => ({ user_id: user.id, policy_id: r.id, policy_version: r.version, user_agent: userAgent })),
    { onConflict: 'user_id, policy_id, policy_version', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function markLanguageDone() {
  await AsyncStorage.setItem(LANGUAGE_DONE, '1').catch(() => {});
}

export async function markPermissionsDone() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await AsyncStorage.setItem(permissionsKey(user.id), '1').catch(() => {});
}

/** That tour was finished or skipped: it doesn't come back on this phone (Profile can replay the main one). */
export async function markTourDone(name: TourName) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await AsyncStorage.setItem(tourKey(user.id, name), '1').catch(() => {});
}

/** True once per person per phone, for field staff. Tips wait until the main tour is done. */
export async function isTourDue(name: TourName): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const seen = (n: TourName) => AsyncStorage.getItem(tourKey(user.id, n)).catch(() => '1');
  if (await seen(name)) return false;
  if (name !== 'main' && !(await seen('main'))) return false;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return ['technician', 'helper'].includes(data?.role ?? '');
}

// The steps this person still has to do on this phone, worked out once after sign-in.
let pending: SetupStep[] = [];
let total = 0;

/**
 * Works out the steps left. If the server can't be reached, the server-side steps are skipped:
 * the app still works, and time-ins are refused by the database until the phone is registered.
 */
export async function loadPendingSteps(): Promise<SetupStep[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [languageDone, permissionsDone, profile] = await Promise.all([
    AsyncStorage.getItem(LANGUAGE_DONE).catch(() => '1'),
    AsyncStorage.getItem(permissionsKey(user.id)).catch(() => '1'),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ]);
  const isFieldStaff = ['technician', 'helper'].includes(profile.data?.role ?? 'technician');

  const steps: SetupStep[] = [];
  if (!languageDone) steps.push('language');
  try {
    if (!(await hasAgreedToRules(user.id))) steps.push('rules');
  } catch {
    // No signal: ask again next time the app opens
  }
  if (isFieldStaff && (await checkThisPhone()) === 'unregistered') steps.push('phone');
  if (isFieldStaff && !(await myPinIsOwn().catch(() => true))) steps.push('pin'); // no signal: ask next time
  if (!permissionsDone) steps.push('permissions');
  if (isFieldStaff && (await myFace(user.id).catch(() => 'skip')) === null) steps.push('face'); // no signal: the save fails and Later appears

  pending = steps;
  total = steps.length;
  return steps;
}

/** Route of a step's screen (cast: the typed-route list is regenerated by expo start). */
export function stepRoute(step: SetupStep): Href {
  return `/setup/${step}` as Href;
}

/** Opens the screen after `step`, or the app when setup is finished. */
export function goAfter(router: { push: (h: Href) => void; replace: (h: Href) => void }, step: SetupStep) {
  const next = nextStep(step);
  if (next) router.push(stepRoute(next));
  else router.replace('/(tabs)' as Href);
}

/** "Step 2 of 4" for the current screen (counted over the steps this person actually has). */
export function stepNumber(step: SetupStep): { step: number; total: number } {
  const index = pending.indexOf(step);
  return { step: index >= 0 ? index + 1 : 1, total: Math.max(total, 1) };
}

/** The screen after this one, or null when setup is finished. */
export function nextStep(after: SetupStep): SetupStep | null {
  const later = ORDER.slice(ORDER.indexOf(after) + 1);
  return pending.find(s => later.includes(s)) ?? null;
}
