// tourTargets: lets Techy's tour (components/tour/TechyTour.tsx) find real parts of the screen to spotlight.
// A part registers itself with ref={tourTarget('timeIn')}; the tour asks where it is with findTarget('timeIn').
import type { View } from 'react-native';

export type TargetBox = { x: number; y: number; width: number; height: number };
const views = new Map<string, View>();

/** Use as a ref: ref={tourTarget('tab-inbox')}. */
export const tourTarget = (key: string) => (view: View | null) => {
  if (view) views.set(key, view); else views.delete(key);
};

/** Where that part is on the screen right now, or null if it isn't showing. */
export function findTarget(key: string): Promise<TargetBox | null> {
  const view = views.get(key);
  if (!view) return Promise.resolve(null);
  return new Promise((done) => view.measureInWindow((x, y, width, height) => done(width > 0 && height > 0 ? { x, y, width, height } : null)));
}
