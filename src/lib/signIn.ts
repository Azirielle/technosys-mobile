// Signing in to the mobile app, and the "one registered phone" check.
//  - Technicians and helpers: mobile number + 4-digit PIN (pin-login edge function).
//  - Everyone: email or username + password (Supabase Auth), then the phone check.
// Signing in never registers the phone: that happens on purpose in setup ("Use this as my work phone").
// Every result is turned into a plain message here, so screens never show raw errors.
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getDeviceId, getDeviceName } from './deviceId';

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'other_phone' } // right details, but another phone is registered
  | { ok: false; reason: 'change_requested' }
  | { ok: false; reason: 'message'; message: string };

const NO_SIGNAL = "Can't reach the server. Check your signal and try again.";
const SERVER_ERROR = 'Sign-in is having a problem on our side. Please try again in a minute.';

/** What the number box keeps: digits only, at most 11, and a pasted +63 9… becomes 09… */
export function toLocalNumber(input: string): string {
  const d = input.replace(/\D/g, '');
  return (d.startsWith('639') ? '0' + d.slice(2) : d).slice(0, 11);
}

/** 09171234567 / +639171234567 / 9171234567 → true */
export function isPhMobile(input: string): boolean {
  return /^(09\d{9}|639\d{9}|9\d{9})$/.test(input.replace(/\D/g, ''));
}

function pinMessage(data: { status?: string; tries_left?: number; minutes?: number }): string {
  switch (data.status) {
    case 'wrong_pin':
      return data.tries_left === 1
        ? 'Wrong PIN. 1 try left before your PIN locks for 15 minutes.'
        : `Wrong PIN. ${data.tries_left ?? 'A few'} tries left.`;
    case 'locked':
      return `Too many wrong PINs. Try again in ${data.minutes ?? 15} minute${data.minutes === 1 ? '' : 's'}, or ask HR to reset your PIN.`;
    case 'wrong_pin_format':
      return 'Enter your 4-digit PIN.';
    case 'unknown_number':
    case 'bad_number':
      return "This number isn't registered. Check it, or ask HR.";
    case 'no_pin':
      return "You don't have a PIN yet. Ask HR to set one for you.";
    case 'inactive':
      return 'This account is not active. Please contact HR.';
    case 'use_email':
      return 'Office accounts sign in with email. Tap "Sign in with email instead" below.';
    default: // 'error' or anything new from the server
      return SERVER_ERROR;
  }
}

/** Mobile number + PIN. With requestChange, asks HR to switch the account to this phone instead. */
export async function signInWithPin(mobile: string, pin: string, requestChange = false): Promise<SignInResult> {
  try {
    const { data, error } = await supabase.functions.invoke('pin-login', {
      body: { mobile, pin, deviceId: await getDeviceId(), deviceName: getDeviceName(), requestChange },
      timeout: 20000, // weak signal: stop the spinner and say so instead of waiting forever
    });
    // The server answered with an error (it was reached), versus no answer at all
    if (error) return { ok: false, reason: 'message', message: error instanceof FunctionsHttpError ? SERVER_ERROR : NO_SIGNAL };
    if (!data) return { ok: false, reason: 'message', message: SERVER_ERROR };

    if (data.status === 'other_phone') return { ok: false, reason: 'other_phone' };
    if (data.status === 'change_requested') return { ok: false, reason: 'change_requested' };
    if ((data.status === 'ok' || data.status === 'unregistered') && data.tokenHash) {
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'email' });
      if (otpError) return { ok: false, reason: 'message', message: 'Could not sign in. Please try again.' };
      return { ok: true };
    }
    return { ok: false, reason: 'message', message: pinMessage(data) };
  } catch {
    return { ok: false, reason: 'message', message: NO_SIGNAL };
  }
}

export type PhoneCheck = 'ok' | 'unregistered' | 'other_phone';

/**
 * Is this the signed-in person's registered phone? Office staff always get 'ok'.
 * 'other_phone' keeps the session only so the person can ask HR; the screen signs out after.
 * If the server can't be reached we let them in: time-ins are still refused by the database
 * unless they come from the registered phone.
 */
export async function checkThisPhone(): Promise<PhoneCheck> {
  try {
    const { data, error } = await supabase.rpc('check_my_phone', { p_device_id: await getDeviceId() });
    if (error) return 'ok';
    return data === 'other_phone' || data === 'unregistered' ? data : 'ok';
  } catch {
    return 'ok';
  }
}

/** Setup step 3: make this phone the person's work phone. */
export async function registerThisPhone(): Promise<'ok' | 'other_phone' | 'no_signal'> {
  try {
    const { data, error } = await supabase.rpc('register_my_phone', {
      p_device_id: await getDeviceId(),
      p_device_name: getDeviceName(),
    });
    if (error) return 'no_signal';
    return data === 'other_phone' ? 'other_phone' : 'ok';
  } catch {
    return 'no_signal';
  }
}

/** Email (or username) + password, then the phone check. */
export async function signInWithEmail(identifier: string, password: string): Promise<SignInResult> {
  const input = identifier.trim().toLowerCase();
  const email = input.includes('@') ? input : `${input}@technocycle.ph`;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const wrong = /invalid login|invalid_credentials|invalid email or password/i.test(error.message || '');
      if (wrong) return { ok: false, reason: 'message', message: 'Wrong email/username or password.' };
      if (/network|fetch/i.test(error.message || '')) return { ok: false, reason: 'message', message: NO_SIGNAL };
      return { ok: false, reason: 'message', message: 'Could not sign in. Please try again.' };
    }
  } catch {
    return { ok: false, reason: 'message', message: NO_SIGNAL };
  }

  const phone = await checkThisPhone();
  if (phone === 'other_phone') return { ok: false, reason: 'other_phone' };
  return { ok: true };
}

/** The database refused a time-in because it didn't come from the registered phone. */
export function isWrongPhoneError(err: unknown): boolean {
  return /not registered to you/i.test(String((err as any)?.message ?? err ?? ''));
}
export const WRONG_PHONE_TITLE = 'Not your registered phone';
export const WRONG_PHONE_MESSAGE = 'You can only time in on your registered phone. If you changed phones, sign out and ask HR to switch your account.';

/** For a signed-in person on the wrong phone (email sign-in): ask HR, then sign out. */
export async function requestPhoneChangeAndSignOut(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('request_my_phone_change', {
      p_device_id: await getDeviceId(),
      p_device_name: getDeviceName(),
    });
    return !error;
  } catch {
    return false;
  } finally {
    await supabase.auth.signOut().catch(() => {});
  }
}
