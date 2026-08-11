import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, shiftDate, daysBetween } from '../js/dateUtils.js';

test('formatDate: ゼロ埋めYYYY-MM-DD', () => {
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('shiftDate: 月境界をまたいで日数を加減できる', () => {
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2026-08-11', -30), '2026-07-12');
});

test('daysBetween: 同日は0', () => {
  assert.equal(daysBetween('2026-08-11', '2026-08-11'), 0);
});

test('daysBetween: 月をまたいだ日数差', () => {
  assert.equal(daysBetween('2026-01-01', '2026-03-01'), 59);
});

test('daysBetween: 年をまたいだ日数差', () => {
  assert.equal(daysBetween('2025-12-25', '2026-01-05'), 11);
});

test('daysBetween: 過去方向は負の値', () => {
  assert.equal(daysBetween('2026-08-11', '2026-08-01'), -10);
});
