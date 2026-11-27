// facePass: the one rule for whether a face check lets you time in (lib/work/useWork). Checked by scripts/check-face-pass.mjs.
import type { FaceResult } from './faceCheck';

export const FACE_MATCH = 0.6; // same as v_threshold in record_face_check (database)
export const FACE_TRIES = 3;

/** Passed = a face was seen, the head turned both ways, and it matches the saved face (no saved face yet = first scan, it is saved now). */
export const facePassed = (r: FaceResult | null, enrolled: boolean) => !!r && r.live && (!enrolled || r.score >= FACE_MATCH);
