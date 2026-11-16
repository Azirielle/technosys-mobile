// Time in and time out: where you are, which site you must be at, and saving the punch.
// The server sets the time of every punch. The database refuses a time-in from any phone but your
// registered one (check_registered_phone), so every punch sends this phone's id.
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import { getDistance } from 'geolib';
import { supabase } from './supabase';
import { syncQueue, generateUUID } from './syncQueue';
import { uploadPhoto } from './photoUpload';
import { getDeviceId } from './deviceId';
import { updateLivePin } from './liveLocation';

export type Spot = { lat: number; lon: number; isMocked: boolean; accuracy: number | null };
export type Site = { name: string; lat: number; lon: number; radius: number };
export type ShiftLog = { id: string; app_time_in: string; app_time_out: string | null; total_hours: number | null; geofence_status: string | null };
type SiteJob = { client_name?: string | null; geofence_lat?: number | null; geofence_lon?: number | null; geofence_radius?: number | null } | null;
type Me = { id: string; full_name?: string | null };

export const metersBetween = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  getDistance({ latitude: a.lat, longitude: a.lon }, { latitude: b.lat, longitude: b.lon });

/** Your position now (high accuracy, or the last known one). */
export async function locateMe(): Promise<Spot | 'no_permission' | 'no_gps'> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return 'no_permission';
  let loc: Location.LocationObject | null = null;
  try { loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); }
  catch { loc = await Location.getLastKnownPositionAsync(); }
  if (!loc) return 'no_gps';
  return { lat: loc.coords.latitude, lon: loc.coords.longitude, isMocked: !!(loc as { mocked?: boolean }).mocked, accuracy: loc.coords.accuracy ?? null };
}

/** Where you must time in: today's job site, or else the nearest company office. Null if neither is set. */
export async function findSite(job: SiteJob, here: Spot | null): Promise<Site | null> {
  if (job?.geofence_lat && job?.geofence_lon) {
    return { name: job.client_name || 'Job site', lat: Number(job.geofence_lat), lon: Number(job.geofence_lon), radius: Number(job.geofence_radius) || 100 };
  }
  const { data: offices } = await supabase.from('office_locations').select('name, latitude, longitude, radius_meters').eq('is_active', true);
  if (!offices?.length) return null;
  const sites = offices.map((o) => ({ name: o.name, lat: Number(o.latitude), lon: Number(o.longitude), radius: Number(o.radius_meters) || 100 }));
  if (!here) return sites[0];
  return sites.reduce((best, s) => (metersBetween(here, s) < metersBetween(here, best) ? s : best));
}

async function isRooted() {
  try { return await Device.isRootedExperimentalAsync(); } catch { return false; }
}

/** Saves a time-in. Outside the site it needs the selfie's path (already uploaded). */
export async function saveTimeIn(me: Me, here: Spot | null, selfiePath?: string): Promise<ShiftLog> {
  const outside = !!selfiePath;
  const rooted = await isRooted();
  const spot = here ?? { lat: 0, lon: 0, isMocked: false, accuracy: null };
  const { data, error } = await supabase
    .from('attendance_logs')
    .insert({
      id: generateUUID(),
      technician_id: me.id,
      latitude: spot.lat,
      longitude: spot.lon,
      status: 'active',
      geofence_status: outside ? 'outside' : 'inside',
      ...(outside ? { photo_url: selfiePath, photo_status: 'pending' } : {}),
      is_mocked: spot.isMocked,
      gps_accuracy: spot.accuracy,
      is_suspicious: rooted || spot.isMocked,
      is_manual_entry: false,
      device_id: await getDeviceId(),
    })
    .select('id, app_time_in, app_time_out, total_hours, geofence_status')
    .single();
  if (error) throw error;
  await updateLivePin({
    techId: me.id, name: me.full_name ?? '', lat: spot.lat, lon: spot.lon, status: 'working',
    at: data.app_time_in ?? new Date().toISOString(), action: outside ? 'clock_in_override' : 'clock_in',
  });
  return data as ShiftLog;
}

/** No signal at the site: keep the time-in on the phone; it's sent when there's signal (lib/syncQueue). */
export async function queueTimeIn(me: Me, here: Spot): Promise<boolean> {
  try {
    await syncQueue.addToQueue('time_in', {
      id: generateUUID(), technician_id: me.id, latitude: here.lat, longitude: here.lon, geofence_status: 'inside',
      is_mocked: here.isMocked, gps_accuracy: here.accuracy, status: 'active', is_manual_entry: false,
      device_id: await getDeviceId(),
    });
    return true;
  } catch {
    return false;
  }
}

/** Uploads a time-in selfie to the private "dtr-selfies" bucket and returns its path. */
export async function uploadSelfie(techId: string, uri: string): Promise<string> {
  const path = `${techId}-${Date.now()}.${uri.split('.').pop() || 'jpeg'}`;
  await uploadPhoto('dtr-selfies', path, uri);
  return path;
}

/** Saves a time-out. A phone clock more than 5 minutes off marks it for HR to check ('pending_close'). */
export async function saveTimeOut(me: Me, log: ShiftLog): Promise<{ timeOut: string; hours: number }> {
  let timeOut = new Date().toISOString();
  let clockOff = false;
  try {
    const { data } = await supabase.rpc('get_server_time');
    if (data) {
      timeOut = new Date(data).toISOString();
      clockOff = Math.abs(Date.now() - Date.parse(timeOut)) > 5 * 60000;
    }
  } catch {
    // no server time: use the phone's
  }
  const hours = Math.round((Math.max(0, Date.parse(timeOut) - Date.parse(log.app_time_in)) / 3600000) * 10) / 10;
  const { error } = await supabase
    .from('attendance_logs')
    .update({ app_time_out: timeOut, total_hours: hours, status: clockOff ? 'pending_close' : 'closed' })
    .eq('id', log.id);
  if (error) await syncQueue.addToQueue('time_out', { log_id: log.id, app_time_out: timeOut, total_hours: hours }).catch(() => {});

  let lat = 0, lon = 0;
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    lat = loc.coords.latitude; lon = loc.coords.longitude;
  } catch {
    // no position: the pin just goes offline
  }
  await updateLivePin({ techId: me.id, name: me.full_name ?? '', lat, lon, status: 'offline', at: timeOut, action: 'clock_out' });
  return { timeOut, hours };
}

/** The selfie wouldn't send: a DTR ticket so HR knows you came to work. */
export async function tellHrCouldntTimeIn(me: Me, here: Spot | null): Promise<boolean> {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const where = here ? `${here.lat.toFixed(5)}, ${here.lon.toFixed(5)}` : 'not available';
  const { error } = await supabase.from('tickets').insert({
    employee_id: me.id,
    category: 'DTR Issue',
    title: `Couldn't time in: ${me.full_name || 'Technician'}`,
    description: `I tried to time in at ${time} but my selfie wouldn't send. My location: ${where}. Please check my attendance for today.`,
    priority: 'medium',
    status: 'open',
  });
  return !error;
}

/** Today's shift: the one still open, or the last one finished today. */
export async function getTodayShift(userId: string): Promise<{ active: ShiftLog | null; done: ShiftLog | null }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('attendance_logs')
    .select('id, app_time_in, app_time_out, total_hours, geofence_status')
    .eq('technician_id', userId)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });
  const logs = (data ?? []) as ShiftLog[];
  const active = logs.find((l) => !l.app_time_out) ?? null;
  return { active, done: active ? null : logs[0] ?? null };
}
