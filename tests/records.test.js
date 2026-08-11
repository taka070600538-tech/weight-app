import test from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertRecord, loadRecords, saveRecords, mergeRecords, deleteRecord, filterFromDate,
} from '../js/records.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('upsertRecord: 同じ日付は上書きされ、日付昇順に並ぶ', () => {
  const result = upsertRecord(
    upsertRecord(upsertRecord([], { date: '2026-08-10', weight: 57 }), { date: '2026-08-09', weight: 58 }),
    { date: '2026-08-10', weight: 56.5 },
  );
  assert.deepEqual(result.map((r) => r.date), ['2026-08-09', '2026-08-10']);
  assert.equal(result[1].weight, 56.5);
});

test('save/load: fakeStorageで往復できる', () => {
  const s = fakeStorage();
  const records = [{ date: '2026-08-11', weight: 56, waist: 75, memo: 'テスト', createdAt: 'x' }];
  saveRecords(s, records);
  assert.deepEqual(loadRecords(s), records);
});

test('loadRecords: 未保存・壊れたJSON・非配列はすべて空配列', () => {
  assert.deepEqual(loadRecords(fakeStorage()), []);
  const s1 = fakeStorage();
  s1.setItem('weight-app:records', '{oops');
  assert.deepEqual(loadRecords(s1), []);
  const s2 = fakeStorage();
  s2.setItem('weight-app:records', '{"not":"array"}');
  assert.deepEqual(loadRecords(s2), []);
});

test('deleteRecord: 指定日の記録だけが消える', () => {
  const records = [{ date: '2026-08-10', weight: 57 }, { date: '2026-08-11', weight: 56 }];
  assert.deepEqual(deleteRecord(records, '2026-08-10').map((r) => r.date), ['2026-08-11']);
});

test('mergeRecords: 同一日付はインポート側優先', () => {
  const merged = mergeRecords(
    [{ date: '2026-08-10', weight: 57 }],
    [{ date: '2026-08-10', weight: 56 }, { date: '2026-08-11', weight: 55 }],
  );
  assert.deepEqual(merged.map((r) => [r.date, r.weight]), [['2026-08-10', 56], ['2026-08-11', 55]]);
});

test('filterFromDate: fromDate以降のみ残る', () => {
  const records = [{ date: '2026-08-01' }, { date: '2026-08-10' }, { date: '2026-08-11' }];
  assert.deepEqual(filterFromDate(records, '2026-08-10').map((r) => r.date), ['2026-08-10', '2026-08-11']);
});
