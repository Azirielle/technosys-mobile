// node scripts/check-techy-action.mjs: Techy's form and button codes (src/lib/techyAction.ts). Prints "ok" or stops at the first wrong case.
import assert from 'node:assert/strict';
import { readAction } from '../src/lib/techyAction.ts';

const a = (text) => readAction(text).action;
assert.deepEqual(a('Fill in the form below 📅\n[FORM:DTR:2026-11-22]'), { form: 'dtr', date: '2026-11-22' }, 'DTR form with a day');
assert.deepEqual(a('[form:dtr: 2026-11-22 ]'), { form: 'dtr', date: '2026-11-22' }, 'lowercase and spaces');
assert.deepEqual(a('[FORM:DTR]'), { form: 'dtr', date: null }, 'no day: the phone shows the DTR button instead');
assert.deepEqual(a('[FORM:DTR:Nov 22]'), { form: 'dtr', date: null }, 'a day that is not YYYY-MM-DD is not used');
assert.deepEqual(a('[FORM:OTHER]'), { form: 'other' }, 'Others form');
assert.deepEqual(a('[GO:TIMEIN]'), { go: 'timein' }, 'one button');
assert.equal(a('[GO:PAYROLL]'), null, 'unknown button: nothing');
assert.equal(a('[FORM:LEAVE]'), null, 'unknown form: nothing');
assert.equal(a('Old answer [ACTION:OPEN_TICKET_FORM]'), null, 'old code: no shortcut list any more');
assert.equal(readAction('Old answer [ACTION:OPEN_TICKET_FORM]').text, 'Old answer', 'old code is hidden');
assert.equal(readAction('Sorry Juan! 📅\n[FORM:DTR:2026-11-22]').text, 'Sorry Juan! 📅', 'the code never shows');
assert.equal(a('Just a normal answer 🙂'), null, 'no code');
console.log('ok');
