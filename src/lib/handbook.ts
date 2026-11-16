// The handbook: company policies a field worker can read, split into "to read" (must-read, not signed at
// this version) and "read and signed". Office-only policies (target_audience 'admin') are never shown.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { supabase } from './supabase';
import type { CompanyPolicy } from '../components/PolicyReaderModal';

export type HandbookItem = { policy: CompanyPolicy; signedAt: string | null; mustRead: boolean };

export async function loadHandbook(): Promise<{ toRead: HandbookItem[]; signed: HandbookItem[]; other: HandbookItem[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const [pol, acks] = await Promise.all([
    supabase.from('policies').select('*').eq('is_active', true).neq('target_audience', 'admin').order('title'),
    supabase.from('policy_acknowledgments').select('policy_id, policy_version, acknowledged_at').eq('user_id', user.id),
  ]);
  if (pol.error) throw pol.error;
  const items: HandbookItem[] = (pol.data ?? []).map((p) => {
    const ack = (acks.data ?? []).find((a) => a.policy_id === p.id && a.policy_version === p.version);
    return { policy: p as unknown as CompanyPolicy, signedAt: ack?.acknowledged_at ?? null, mustRead: !!p.is_mandatory };
  });
  return {
    toRead: items.filter((i) => i.mustRead && !i.signedAt),
    signed: items.filter((i) => !!i.signedAt),
    other: items.filter((i) => !i.mustRead && !i.signedAt),
  };
}

/** "I've read this": records the signature HR sees in Policies → Signatures. */
export async function signPolicy(policyId: string, version: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('policy_acknowledgments').upsert(
    { user_id: user.id, policy_id: policyId, policy_version: version, user_agent: `TechnoSys Mobile (${Platform.OS}; ${Device.modelName || 'Phone'})` },
    { onConflict: 'user_id, policy_id, policy_version', ignoreDuplicates: true },
  );
  return !error;
}

/** Plain name and icon for a policy's category. */
export function categoryOf(category: string): { label: string; icon: 'shield' | 'clock' | 'tool' | 'users' | 'alert-triangle' | 'book-open' } {
  switch (category) {
    case 'legal': return { label: 'App rules', icon: 'shield' };
    case 'hr_attendance': return { label: 'Attendance', icon: 'clock' };
    case 'inventory': return { label: 'Tools', icon: 'tool' };
    case 'conduct': return { label: 'Conduct', icon: 'users' };
    case 'field_ops': return { label: 'Safety', icon: 'alert-triangle' };
    default: return { label: 'Company rules', icon: 'book-open' };
  }
}
