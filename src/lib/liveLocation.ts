// The office's live map: this person's latest position (one row in live_locations; the admin map listens to its changes).
// Sent at time-in and time-out, and every minute while timed in and the app is open.
// A failed update never stops a time-in or time-out: the map just catches up on the next one.
import * as Location from 'expo-location';
import { supabase } from './supabase';

type Pin = { techId: string; lat: number; lon: number; status: 'working' | 'offline'; at: string };

export async function updateLivePin(p: Pin): Promise<void> {
  try {
    await supabase.from('live_locations').upsert({
      technician_id: p.techId, latitude: p.lat, longitude: p.lon, status: p.status, updated_at: p.at,
    });
  } catch (err) {
    console.warn('[live map] update skipped:', err);
  }
}

const EVERY_MS = 60000;

/** While timed in: sends your position now and every minute. Returns the stop function. */
export function startLocationUpdates(techId: string): () => void {
  let stopped = false;
  const send = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || stopped) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (stopped) return;
      await updateLivePin({ techId, lat: loc.coords.latitude, lon: loc.coords.longitude, status: 'working', at: new Date().toISOString() });
    } catch {
      // a GPS blip: try again next minute
    }
  };
  send();
  const timer = setInterval(send, EVERY_MS);
  return () => { stopped = true; clearInterval(timer); };
}
