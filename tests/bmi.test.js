import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBmi, bmiCategory } from '../js/bmi.js';

test('computeBmi: 56kg/170cm → 19.4', () => {
  assert.equal(computeBmi(56, 170), 19.4);
});

test('computeBmi: 身長・体重が不正ならnull', () => {
  assert.equal(computeBmi(56, null), null);
  assert.equal(computeBmi(NaN, 170), null);
  assert.equal(computeBmi(56, 0), null);
});

test('bmiCategory: 境界値で判定が切り替わる', () => {
  assert.equal(bmiCategory(18.4).label, '低体重');
  assert.equal(bmiCategory(18.5).label, '普通体重');
  assert.equal(bmiCategory(25).label, '肥満(1度)');
  assert.equal(bmiCategory(30).label, '肥満(2度以上)');
});
