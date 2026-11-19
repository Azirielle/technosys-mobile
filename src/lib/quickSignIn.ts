// Quick sign-in on a technician's own phone (like GCash): the phone remembers who signed in last, so next time the
// sign-in screen says "Welcome back" and asks only for the PIN, or a fingerprint / face. Also: making your own PIN.
// The PIN for fingerprint sign-in is kept in the phone's secure storage (encrypted by the phone) and only read after
// the fingerprint matches; it's sent to the same PIN sign-in as typing it, so every server check still applies.
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from './supabase';
import { signInWithPin, type SignInResult } from './signIn';

export type Remembered = { mobile: string; firstName: string };
const WHO = 'quick_signin_who';
const BIO_PIN = 'quick_signin_pin';

export async function getRemembered(): Promise<Remembered | null> {
  try {
    const raw = await SecureStore.getItemAsync(WHO);
    return raw ? (JSON.parse(raw) as Remembered) : null;
  } catch {
    return null;
  }
}

/** After a PIN sign-in: remember this person on this phone (name from their profile). */
export async function remember(mobile: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = user ? await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : { data: null };
    const firstName = (data?.full_name ?? '').trim().split(/\s+/)[0] || '';
    await SecureStore.setItemAsync(WHO, JSON.stringify({ mobile, firstName }));
  } catch { /* the full sign-in form still works */ }
}

/** "Not you?": forget this person and their fingerprint sign-in. */
export async function forget(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(WHO), SecureStore.deleteItemAsync(BIO_PIN)]).catch(() => {});
}

/** Does this phone have a fingerprint or face set up? */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricOn(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(BIO_PIN).catch(() => null));
}

/** Turn fingerprint sign-in on with the PIN the person just typed; asks for the fingerprint once to confirm. */
export async function turnBiometricOn(pin: string, prompt: string): Promise<boolean> {
  const check = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: true }).catch(() => null);
  if (!check?.success) return false;
  await SecureStore.setItemAsync(BIO_PIN, pin);
  return true;
}

export async function turnBiometricOff(): Promise<void> {
  await SecureStore.deleteItemAsync(BIO_PIN).catch(() => {});
}

/** Fingerprint, then the saved PIN goes through the normal PIN sign-in. null = cancelled or no fingerprint match. */
export async function signInWithBiometric(who: Remembered, prompt: string): Promise<SignInResult | null> {
  const check = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: true }).catch(() => null);
  if (!check?.success) return null;
  const pin = await SecureStore.getItemAsync(BIO_PIN).catch(() => null);
  if (!pin) return null;
  const result = await signInWithPin(who.mobile, pin);
  // HR reset the PIN since: the saved one is old, so stop offering the fingerprint until they turn it on again
  if (!result.ok && result.reason === 'message' && /PIN/.test(result.message)) await turnBiometricOff();
  return result;
}

/** Is my PIN my own, or still HR's temporary one? Setup asks for an own PIN until it is. */
export async function myPinIsOwn(): Promise<boolean> {
  const { data, error } = await supabase.rpc('my_pin_is_own');
  if (error) throw error;
  return !!data;
}

export type SetPinResult = 'saved' | 'weak' | 'wrong_current' | 'no_signal';

/** Saves a new own PIN (current PIN needed when changing an own PIN). A saved fingerprint PIN is updated too. */
export async function setMyPin(newPin: string, currentPin?: string): Promise<SetPinResult> {
  try {
    const { data, error } = await supabase.rpc('set_my_pin', { p_new: newPin, p_current: currentPin });
    if (error) return 'no_signal';
    const status = (data as { status?: string } | null)?.status;
    if (status === 'saved') {
      if (await biometricOn()) await SecureStore.setItemAsync(BIO_PIN, newPin);
      return 'saved';
    }
    return status === 'weak' || status === 'wrong_current' ? status : 'no_signal';
  } catch {
    return 'no_signal';
  }
}
