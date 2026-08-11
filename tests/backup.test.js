import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackupPayload, validateBackupData } from '../js/backup.js';

test('buildBackupPayload: version/exportedAt/records/profileを含む', () => {
  const now = new Date('2026-08-11T00:00:00Z');
  const payload = buildBackupPayload([{ date: '2026-08-11' }], { height: 170 }, now);
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2026-08-11T00:00:00.000Z');
  assert.equal(payload.records.length, 1);
  assert.equal(payload.profile.height, 170);
});

test('validateBackupData: 正常データはそのまま返す', () => {
  const data = { version: 1, records: [] };
  assert.equal(validateBackupData(data), data);
});

test('validateBackupData: version不正・records非配列はthrow', () => {
  assert.throws(() => validateBackupData(null));
  assert.throws(() => validateBackupData({ version: 2, records: [] }));
  assert.throws(() => validateBackupData({ version: 1, records: 'x' }));
});
