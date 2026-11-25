// Work v2 jobs for the Jobs tab and job details, in the shapes those screens already use (lib/jobs, lib/crew,
// lib/jobDetails), so the screens don't change at the switch-over. A multi-day job shows as the day that
// matters: today if it runs today, else its first day. "What changed" comes from job_events.
import { supabase } from '../supabase';
import { getMyWorkJobs, type MyJob } from './workApi';
import type { Job, JobChange } from '../jobs';
import type { CrewMember } from '../crew';
import type { JobDetails } from '../jobDetails';

const ASSIGNMENT: Record<string, string> = { on_site: 'on_site', out_of_town: 'deployment', office: 'office_duty' };
const manilaToday = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

function asJob(j: MyJob): Job {
  const today = manilaToday();
  const day = j.start_date <= today && today <= j.end_date ? today : j.start_date;
  const at = (time: string) => new Date(`${day}T${time.slice(0, 8)}+08:00`).toISOString();
  return {
    id: j.id, technician_id: null, client_name: j.client_name, location: j.address, start_time: at(j.start_time), end_time: at(j.end_time),
    status: j.status === 'ongoing' ? 'scheduled' : j.status === 'done' ? 'completed' : j.status, assignment_type: ASSIGNMENT[j.work_type] ?? 'on_site',
    geofence_lat: j.site_lat, geofence_lon: j.site_lon, is_vip_hook: j.is_vip, cancellation_reason: j.cancel_reason, priority: j.priority,
  };
}

/** All your jobs (last 30 days on) and the office's changes to them this week. */
export async function loadWorkJobs(): Promise<{ jobs: Job[]; changes: JobChange[] }> {
  const mine = await getMyWorkJobs();
  const jobs = mine.map(asJob);
  if (!jobs.length) return { jobs, changes: [] };
  const { data } = await supabase.from('job_events').select('job_id, kind, at, reason, details')
    .in('job_id', jobs.map((j) => j.id)).in('kind', ['created', 'moved', 'cancelled', 'crew_changed'])
    .gte('at', new Date(Date.now() - 7 * 86400000).toISOString()).order('at', { ascending: false });
  const name = (id: string) => jobs.find((j) => j.id === id)?.client_name ?? '';
  const changes: JobChange[] = [];
  for (const e of data ?? []) {
    const base = { jobId: e.job_id, jobName: name(e.job_id), at: e.at, reason: e.reason };
    const d = (e.details ?? {}) as { before?: { start_date?: string; start_time?: string }; after?: { start_date?: string; start_time?: string } };
    const iso = (x?: { start_date?: string; start_time?: string }) => (x?.start_date && x.start_time ? new Date(`${x.start_date}T${x.start_time.slice(0, 5)}:00+08:00`).toISOString() : undefined);
    if (e.kind === 'moved') changes.push({ ...base, kind: 'moved', from: iso(d.before), to: iso(d.after) });
    else if (e.kind === 'cancelled') changes.push({ ...base, kind: 'cancelled' });
    else if (e.kind === 'crew_changed') changes.push({ ...base, kind: 'crew' });
    else if (Date.now() - Date.parse(e.at) < 2 * 86400000) changes.push({ ...base, kind: 'added', reason: null });
  }
  return { jobs, changes };
}

/** One job for the job details screen. */
export async function getWorkJob(id: string): Promise<JobDetails | null> {
  const { data, error } = await supabase.from('jobs')
    .select('id, client_name, address, project_name, scope, notes, site_lat, site_lon, site_radius_m, start_date, end_date, start_time, end_time, work_type, report_to, status, cancel_reason, is_vip, priority')
    .eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const job = asJob({ ...data, role: 'crew', vehicle: null, mine: true } as MyJob);
  const where = data.report_to === 'hq' ? 'Report to the office first, then ride to the site together.' : 'Go straight to the site.';
  const days = data.start_date === data.end_date ? '' : ` This job runs ${data.start_date} to ${data.end_date}.`;
  return { ...job, project_name: data.project_name, scope: data.scope, geofence_radius: data.site_radius_m, reporting_instruction: `${where}${days}${data.notes ? ` ${data.notes}` : ''}` };
}

const ROLE: Record<string, string> = { lead: 'Lead', crew: 'Crew', driver: 'Driver', helper: 'Helper' };

/** Everyone on the job: people (with the driver's vehicle) and temporary workers. */
export async function getWorkCrew(jobId: string, myId?: string | null): Promise<CrewMember[]> {
  const { data } = await supabase.from('job_members')
    .select('role, is_acting_lead, removed_at, person:profiles!job_members_person_id_fkey ( id, full_name, contact_number ), temp:casual_helpers ( id, full_name, contact_number ), vehicle:vehicles ( plate )')
    .eq('job_id', jobId).is('removed_at', null);
  const order = { lead: 0, driver: 1, crew: 2, helper: 3 } as Record<string, number>;
  return (data ?? [])
    .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    .map((m) => {
      const p = m.person as { id: string; full_name: string | null; contact_number: string | null } | null;
      const t = m.temp as { id: string; full_name: string | null; contact_number: string | null } | null;
      const v = m.vehicle as { plate?: string } | null;
      const who = p ?? t!;
      const label = t ? 'Temporary helper' : m.is_acting_lead ? 'Acting lead' : `${ROLE[m.role] ?? 'Crew'}${v?.plate ? ` · ${v.plate}` : ''}`;
      return {
        id: who.id, name: p && myId && p.id === myId ? `${p.full_name} (You)` : who.full_name || 'Crew', role: label,
        phone: who.contact_number || undefined, type: t ? 'casual' : m.role === 'lead' || m.is_acting_lead ? 'lead' : 'helper',
      } as CrewMember;
    });
}
