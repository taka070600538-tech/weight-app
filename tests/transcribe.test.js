import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDaySection, upsertSection, datesToTranscribe } from '../tools/transcribe.mjs';

const records = [
  { date: '2026-08-10', weight: 63.3, waist: 88.5, memo: '内臓脂肪面積　159.8 cm² (BMI: 22.7)' },
  { date: '2026-08-11', weight: 62.1, waist: null, memo: '' },
  { date: '2026-08-12', weight: null, waist: null, memo: '' },
];

test('buildDaySection: 体重・腹囲・メモをすべて出す', () => {
  assert.equal(
    buildDaySection(records, '2026-08-10'),
    '## 体重・腹囲\n\n- 体重: 63.3kg\n- 腹囲: 88.5cm\n- メモ: 内臓脂肪面積　159.8 cm² (BMI: 22.7)'
  );
});

test('buildDaySection: null・空文字の行は省略する', () => {
  assert.equal(buildDaySection(records, '2026-08-11'), '## 体重・腹囲\n\n- 体重: 62.1kg');
});

test('buildDaySection: 全部省略、または記録が無ければnull', () => {
  assert.equal(buildDaySection(records, '2026-08-12'), null);
  assert.equal(buildDaySection(records, '2026-01-01'), null);
});

test('datesToTranscribe: 当日を除いた日付昇順', () => {
  assert.deepEqual(datesToTranscribe(records, '2026-08-12'), ['2026-08-10', '2026-08-11']);
});

test('upsertSection: マーカーが無ければ末尾に追記', () => {
  const out = upsertSection('既存の本文\n', 'セクション');
  assert.equal(out, '既存の本文\n\n<!-- weight-app:start -->\nセクション\n<!-- weight-app:end -->\n');
});

test('upsertSection: 既存マーカー区間だけを置換し他は触らない', () => {
  const before = '前文\n\n<!-- weight-app:start -->\n古い内容\n<!-- weight-app:end -->\n後文\n';
  const out = upsertSection(before, '新しい内容');
  assert.equal(out, '前文\n\n<!-- weight-app:start -->\n新しい内容\n<!-- weight-app:end -->\n後文\n');
});

test('upsertSection: CRLFの日記ではCRLFを保つ', () => {
  const out = upsertSection('本文\r\n', 'A\nB');
  assert.equal(out, '本文\r\n\r\n<!-- weight-app:start -->\r\nA\r\nB\r\n<!-- weight-app:end -->\r\n');
});

test('upsertSection: 空ファイルにはブロックのみ', () => {
  assert.equal(upsertSection('', 'S'), '<!-- weight-app:start -->\nS\n<!-- weight-app:end -->\n');
});
