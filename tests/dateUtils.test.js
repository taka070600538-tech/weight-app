import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, shiftDate } from '../js/dateUtils.js';

test('formatDate: ゼロ埋めYYYY-MM-DD', () => {
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('shiftDate: 月境界をまたいで日数を加減できる', () => {
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2026-08-11', -30), '2026-07-12');
});
