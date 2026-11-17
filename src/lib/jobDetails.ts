// One job for the job details screen (opened from Home "Details" or a job on the Jobs tab), and where you are
// now so the map can show you and the site. The access rules only return jobs you're on.
import * as Location from 'expo-location';
import { supabase } from './supabase';
import type { Job } from './jobs';
import { WORK_V2 } from './work/workApi';
import { getWorkJob } from './work/workJobs';

export type JobDetails = Job & { reporting_instruction: string | null; project_name: string | null; geofence_radius: number | null };

export async function getJob(id: string): Promise<JobDetails | null> {
  if (WORK_V2) return getWorkJob(id);
  const { data, error } = await supabase
    .from('schedules')
    .select('id, technician_id, client_name, location, start_time, end_time, status, assignment_type, geofence_lat, geofence_lon, geofence_radius, is_vip_hook, cancellation_reason, reporting_instruction, project_name')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as JobDetails | null;
}

/** Your last known spot (fast), or null if location is off. Never asks for permission here. */
export async function whereAmI(): Promise<{ lat: number; lon: number } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const last = await Location.getLastKnownPositionAsync();
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Straight-line distance in km (good enough for "10.2 km away"). */
export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
