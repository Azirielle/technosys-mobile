// node scripts/check-face-pass.mjs: the face pass rule (src/lib/face/facePass.ts). Prints "ok" or stops at the first wrong case.
import assert from 'node:assert/strict';
import { facePassed } from '../src/lib/face/facePass.ts';

const face = (score, live) => ({ uri: 'x.jpg', score, live });
assert.equal(facePassed(null, true), false, 'no face seen');
assert.equal(facePassed(face(0.9, false), true), false, 'no head turn');
assert.equal(facePassed(face(0.59, true), true), false, 'low score');
assert.equal(facePassed(face(0.6, true), true), true, 'match');
assert.equal(facePassed(face(0, true), false), true, 'first scan: nothing to compare yet');
assert.equal(facePassed(face(0, false), false), false, 'first scan still needs the head turns');
console.log('ok');
