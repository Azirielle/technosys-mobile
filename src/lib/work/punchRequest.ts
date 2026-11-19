// A "Time in" / "Time out" tap on a reminder push (send_attendance_reminders on the server), handed to Home, which
// runs the normal time-in or time-out (location check, selfie if outside). Kept until Home is open to take it.
export type Punch = 'in' | 'out';
type Listener = (p: Punch) => void;

let waiting: Punch | null = null;
const listeners = new Set<Listener>();

export function requestPunch(p: Punch) {
  if (listeners.size) listeners.forEach((l) => l(p));
  else waiting = p; // Home isn't open yet (the push opened the app): it takes this when it opens
}

/** Home listens; a tap that came before Home opened is handed over right away. Returns the unsubscribe. */
export function onPunchRequest(l: Listener): () => void {
  listeners.add(l);
  if (waiting) { const p = waiting; waiting = null; l(p); }
  return () => { listeners.delete(l); };
}
