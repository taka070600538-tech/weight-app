import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, saveProfile } from '../js/profile.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('loadProfile: 未保存なら全てnull', () => {
  assert.deepEqual(loadProfile(fakeStorage()), { height: null, targetWeight: null, targetWaist: null });
});

test('save/load: 往復でき、欠けたキーはnullで補完される', () => {
  const s = fakeStorage();
  saveProfile(s, { height: 170 });
  assert.deepEqual(loadProfile(s), { height: 170, targetWeight: null, targetWaist: null });
});

test('loadProfile: 壊れたJSONなら全てnull', () => {
  const s = fakeStorage();
  s.setItem('weight-app:profile', '{oops');
  assert.deepEqual(loadProfile(s), { height: null, targetWeight: null, targetWaist: null });
});
