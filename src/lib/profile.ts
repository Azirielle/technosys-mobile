// The signed-in person's profile and small counts shown on the Me tab.
import { supabase } from './supabase';

export type MyProfile = {
  id: string;
  full_name: string;
  role: string;
  technician_level: string | null;
  contact_number: string | null;
  avatar_url: string | null;
};

export async function getMyProfile(): Promise<MyProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, technician_level, contact_number, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data as MyProfile | null;
}

/** Must-read company policies this person hasn't signed at their current version (office-only ones excluded). */
export async function countPoliciesToRead(userId: string): Promise<number> {
  const [{ data: policies }, { data: acks }] = await Promise.all([
    supabase.from('policies').select('id, version, target_audience').eq('is_active', true).eq('is_mandatory', true),
    supabase.from('policy_acknowledgments').select('policy_id, policy_version').eq('user_id', userId),
  ]);
  return (policies ?? [])
    .filter((p) => p.target_audience !== 'admin')
    .filter((p) => !(acks ?? []).some((a) => a.policy_id === p.id && a.policy_version === p.version)).length;
}

/** "Ramon Santos" → "RS" */
export function initials(name: string | null | undefined): string {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

/** 09171234501 → 0917 123 4501 */
export function prettyMobile(n: string | null | undefined): string {
  const d = (n ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : (n ?? '');
}
