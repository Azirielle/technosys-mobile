// A small signal to the Home screen: "open this feature". Several features (tools, support, updates,
// timesheets, forms, settings, sign-out…) still live as pop-ups inside app/(tabs)/index.tsx until their
// own redesign phase. The Me tab and Techy use this to open them; Home listens with onHomeAction().
export type HomeAction =
  | 'tools' | 'support' | 'fileLeave' | 'updates' | 'notifications' | 'timesheets' | 'leaves'
  | 'forms' | 'preferences' | 'logout' | 'clockIn';

type Listener = (action: HomeAction) => void;
const listeners = new Set<Listener>();

export function onHomeAction(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Asks Home to open a feature (the caller switches to the Home tab first). */
export function sendHomeAction(action: HomeAction) {
  listeners.forEach((l) => l(action));
}
