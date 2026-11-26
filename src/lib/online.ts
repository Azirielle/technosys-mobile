// Is the phone online? Asks the server every 20 s and whenever the app comes back to the front. When the signal
// returns it first sends what was saved on the phone (lib/syncQueue), then tells the screens so they reload.
// Plain fetch on purpose: NetInfo is a native module and would need a new app build.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabaseUrl } from './supabase';
import { syncQueue } from './syncQueue';

let online = true;
const listeners = new Set<(on: boolean) => void>();
let stop: (() => void) | null = null;

async function check() {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 6000);
  let ok = true;
  // Any answer (even "unauthorized") means the server is reachable; only a failed request means no signal.
  try { await fetch(`${supabaseUrl}/auth/v1/health`, { signal: abort.signal }); } catch { ok = false; } finally { clearTimeout(timer); }
  if (ok === online) return;
  online = ok;
  if (ok) await syncQueue.syncPendingQueue().catch(() => {});
  listeners.forEach((l) => l(ok));
}

function start() {
  const timer = setInterval(check, 20000);
  const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
  check();
  return () => { clearInterval(timer); sub.remove(); };
}

/** Listen to signal changes; the checks run while anyone listens. Returns the unsubscribe. */
function listen(l: (on: boolean) => void) {
  listeners.add(l);
  if (!stop) stop = start();
  return () => { listeners.delete(l); if (!listeners.size && stop) { stop(); stop = null; } };
}

/** true / false as the phone's signal changes. */
export function useOnline(): boolean {
  const [on, setOn] = useState(online);
  useEffect(() => listen(setOn), []);
  return on;
}

/** Calls `fn` each time the signal comes back (after saved punches were sent), not on start. Returns the unsubscribe. */
export const whenBackOnline = (fn: () => void) => listen((on) => { if (on) fn(); });
