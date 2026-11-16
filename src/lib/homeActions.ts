// A small signal to the Home screen: "open the Support chat". Support still lives as a pop-up on Home, so
// Techy (on every tab) and the Inbox (an HR reply) use this; Home listens with onHomeAction().
export type HomeAction = { kind: 'support'; ticketId?: string };

type Listener = (action: HomeAction) => void;
const listeners = new Set<Listener>();

export function onHomeAction(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Asks Home to open Support (the caller switches to the Home tab first). */
export function sendHomeAction(action: HomeAction) {
  listeners.forEach((l) => l(action));
}
