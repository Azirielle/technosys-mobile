// Leave: your requests (waiting, approved, declined with HR's reason) and filing a new one. A sick leave needs a
// medical certificate photo, uploaded to the "leaves" bucket and linked on the request for HR.
import { supabase } from './supabase';
import { uploadPhoto } from './photoUpload';

export type LeaveType = 'vacation' | 'sick' | 'emergency' | 'unpaid';
export type MyLeave = {
  id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  rejection_reason: string | null;
  attachment_url: string | null;
};

export async function getMyLeaves(): Promise<MyLeave[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('leaves')
    .select('id, leave_type, start_date, end_date, reason, status, rejection_reason, attachment_url')
    .eq('technician_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as MyLeave[];
}

/** Workdays-ish count shown to the person: every day from start to end, inclusive. */
export const leaveDays = (start: string, end: string) =>
  Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1);

export type FileLeaveInput = { type: LeaveType; start: string; end: string; reason: string; certificateUri?: string | null };
export type FileLeaveResult = { ok: true } | { ok: false; reason: 'upload' | 'save' };

export async function fileLeave(input: FileLeaveInput): Promise<FileLeaveResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'save' };
  let attachment: string | null = null;
  if (input.certificateUri) {
    const path = `${user.id}/certificate-${Date.now()}.jpg`;
    try { await uploadPhoto('leaves', path, input.certificateUri); } catch { return { ok: false, reason: 'upload' }; }
    attachment = supabase.storage.from('leaves').getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.from('leaves').insert({
    technician_id: user.id, leave_type: input.type, start_date: input.start, end_date: input.end,
    reason: input.reason.trim(), status: 'pending', attachment_url: attachment,
  });
  return error ? { ok: false, reason: 'save' } : { ok: true };
}
