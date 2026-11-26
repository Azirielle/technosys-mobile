// Self-check for src/lib/manilaDay.ts (an offline time-in shows as "today" by this day). Run: node scripts/check-manila-day.mjs
import assert from 'node:assert/strict';
import { manilaDay } from '../src/lib/manilaDay.ts';

assert.equal(manilaDay('2026-11-25T15:59:00Z'), '2026-11-25'); // 11:59 PM Manila
assert.equal(manilaDay('2026-11-25T16:00:00Z'), '2026-11-26'); // midnight Manila
assert.equal(manilaDay('2026-11-25T17:30:00+00:00'), '2026-11-26');
assert.equal(manilaDay('2026-12-31T16:30:00Z'), '2027-01-01'); // new year in Manila first
console.log('manilaDay ok');
