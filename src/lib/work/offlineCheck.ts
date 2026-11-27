// offlineCheck: with no signal the phone can't ask the database, so before saving a time-in it checks what it can
// from the jobs it saved earlier, with the database's own time_in rules: a job today, not more than 60 min early,
// and (for a site job) inside the site circle. Outside or no GPS → the normal selfie + reason, kept for later.
// The database still decides when the time-in is finally sent; this only stops one that would surely be refused.
import { manilaDay } from '../jobs';
import { metersBetween, type Spot } from '../timeIn';
import type { MyJob, WorkResult } from './workApi';

export function offlineCheck(jobs: MyJob[], here: Spot | null, hasSelfie: boolean): WorkResult | null {
  const today = manilaDay(new Date());
  const job = jobs
    .filter((j) => j.mine && ['planned', 'ongoing'].includes(j.status) && j.start_date <= today && today <= j.end_date)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  if (!job) return { status: 'no_job' };
  const opens = Date.parse(`${today}T${job.start_time.slice(0, 8)}+08:00`) - 3600000;
  if (Date.now() < opens) return { status: 'too_early', opens_at: new Date(opens).toISOString() };
  if (job.report_to !== 'site' || hasSelfie) return null;
  const place = { place_name: job.client_name, place_lat: job.site_lat, place_lon: job.site_lon, radius_m: job.site_radius_m };
  if (!here) return { status: 'need_selfie', ...place };
  const distance_m = Math.round(metersBetween(here, { lat: job.site_lat, lon: job.site_lon }));
  if (here.isMocked) return { status: 'fake_gps', distance_m, ...place };
  return distance_m > job.site_radius_m ? { status: 'outside', distance_m, ...place } : null;
}
