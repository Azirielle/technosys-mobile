// Loads everyone on one job: the lead (schedules.technician_id), the crew the coordinator
// added (schedule_crew, still active) and casual helpers (schedule_casual_helpers).
import { supabase } from './supabase';
import { WORK_V2 } from './work/workApi';
import { getWorkCrew } from './work/workJobs';

export type CrewMember = {
  id: string;
  name: string;
  role: string; // plain label shown under the name, e.g. "Lead", "Helper", "Driver"
  phone?: string;
  type: 'lead' | 'helper' | 'casual';
};

const ROLE_LABELS: Record<string, string> = {
  lead: 'Lead',
  crew: 'Crew',
  driver: 'Driver',
  helper: 'Helper',
};

export async function getJobCrew(
  job: { id: string; technician_id?: string | null },
  myId?: string | null
): Promise<CrewMember[]> {
  if (WORK_V2) return getWorkCrew(job.id, myId);
  const [leadRes, crewRes, casualRes] = await Promise.all([
    job.technician_id
      ? supabase.from('profiles').select('id, full_name, contact_number').eq('id', job.technician_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('schedule_crew')
      .select('technician_id, assignment_role, profiles!technician_id(id, full_name, contact_number)')
      .eq('schedule_id', job.id)
      .eq('status', 'active'),
    supabase
      .from('schedule_casual_helpers')
      .select('casual_helpers(id, full_name, contact_number)')
      .eq('schedule_id', job.id),
  ]);

  const you = (id: string, name: string) => (myId && id === myId ? `${name} (You)` : name);
  const members: CrewMember[] = [];

  const lead = leadRes.data as { id: string; full_name: string | null; contact_number: string | null } | null;
  if (lead) {
    members.push({ id: lead.id, name: you(lead.id, lead.full_name || 'Lead'), role: 'Lead', phone: lead.contact_number || undefined, type: 'lead' });
  }

  for (const row of (crewRes.data || []) as any[]) {
    const p = row.profiles;
    if (!p || p.id === lead?.id) continue; // the lead may also have a crew row
    members.push({
      id: p.id,
      name: you(p.id, p.full_name || 'Crew'),
      role: ROLE_LABELS[row.assignment_role] || 'Crew',
      phone: p.contact_number || undefined,
      type: row.assignment_role === 'lead' ? 'lead' : 'helper',
    });
  }

  for (const row of (casualRes.data || []) as any[]) {
    const c = row.casual_helpers;
    if (!c) continue;
    members.push({ id: c.id, name: c.full_name || 'Helper', role: 'Temporary helper', phone: c.contact_number || undefined, type: 'casual' });
  }

  return members;
}
