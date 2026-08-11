# 体重・腹囲手帳アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 体重(kg)と腹囲(cm)を記録し、BMI自動計算・推移グラフ・GitHub自動バックアップを備えたPWAを作る。

**Architecture:** 血圧手帳アプリ(`D:\Obsidian Vault for Claude Code\Git\血圧手帳アプリ`)と同型。index.html + ESモジュール分割 + 自前SVGグラフ + sw.js(PWA)+ app-sync共通基盤。外部依存ゼロ、テストは node:test。

**Tech Stack:** Vanilla JS (ESM) / SVG / Service Worker / node:test / app-sync (https://taka070600538-tech.github.io/app-sync/v1/sync.js)

## Global Constraints

- 作業ディレクトリ: `D:\Obsidian Vault for Claude Code\Git\体重腹囲アプリ`(git初期化済み、mainブランチ)
- 外部npm依存は一切追加しない(devDependenciesも不可)
- localStorage キーは必ず `weight-app:` プレフィックス(同一オリジン全アプリで共有されるため)
- UIテキストはすべて日本語
- sw.js で app-sync のURL(github.io/app-sync)をキャッシュしない
- テストコマンド: `npm test`(= `node --test tests/*.test.js`)
- ローカルサーバー: port 8124(血圧手帳の8123と衝突回避)
- テーマカラー: `#059669`(エメラルド)
- アプリ名: 「体重・腹囲手帳」

---

### Task 1: プロジェクト土台と dateUtils

**Files:**
- Create: `package.json`, `.gitignore`, `js/dateUtils.js`, `tests/dateUtils.test.js`

**Interfaces:**
- Produces: `formatDate(date: Date): string`(YYYY-MM-DD)、`shiftDate(dateStr: string, days: number): string`

- [ ] **Step 1: package.json と .gitignore を作成**

`package.json`:
```json
{
  "name": "weight-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

`.gitignore`:
```
node_modules/
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/dateUtils.test.js`:
```js
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
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(`js/dateUtils.js` が存在しない)

- [ ] **Step 4: 実装**

`js/dateUtils.js`(血圧手帳と同一のロジック):
```js
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDate(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test`
Expected: PASS(2件)

- [ ] **Step 6: コミット**

```bash
git add package.json .gitignore js/dateUtils.js tests/dateUtils.test.js
git commit -m "feat: プロジェクト土台とdateUtils"
```

---

### Task 2: records(記録のCRUD)

**Files:**
- Create: `js/records.js`, `tests/records.test.js`

**Interfaces:**
- Produces:
  - 記録の形: `{ date: 'YYYY-MM-DD', weight?: number, waist?: number, memo?: string, createdAt: string }`(weight/waistはどちらか一方でも可、値なしはキーごと省略ではなく `null` でも可だがUI側は `!= null` で判定する)
  - `upsertRecord(records, record): records`(同じdateを置換、日付昇順を維持)
  - `loadRecords(storage): records` / `saveRecords(storage, records): void`(キー `'weight-app:records'`)
  - `mergeRecords(existing, imported): records`(インポート側優先)
  - `deleteRecord(records, date): records`
  - `filterFromDate(records, fromDate): records`(fromDate以降のみ。recordsは日付昇順前提)

- [ ] **Step 1: 失敗するテストを書く**

`tests/records.test.js`:
```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(`js/records.js` が存在しない)

- [ ] **Step 3: 実装**

`js/records.js`:
```js
// 記録の保存形式: { date: 'YYYY-MM-DD', weight, waist, memo, createdAt }
// 1日1件(dateがキー)。weight/waistは片方のみでも可。storageはlocalStorage互換(テストではフェイクを注入)。
const KEY = 'weight-app:records';

export function upsertRecord(records, record) {
  const rest = records.filter((r) => r.date !== record.date);
  return [...rest, record].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function loadRecords(storage) {
  try {
    const raw = storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(storage, records) {
  storage.setItem(KEY, JSON.stringify(records));
}

export function mergeRecords(existing, imported) {
  return imported.reduce((acc, record) => upsertRecord(acc, record), existing);
}

export function deleteRecord(records, date) {
  return records.filter((r) => r.date !== date);
}

export function filterFromDate(records, fromDate) {
  return records.filter((r) => r.date >= fromDate);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add js/records.js tests/records.test.js
git commit -m "feat: 記録のCRUD(records)"
```

---

### Task 3: bmi・profile・backup(純粋ロジック)

**Files:**
- Create: `js/bmi.js`, `js/profile.js`, `js/backup.js`
- Test: `tests/bmi.test.js`, `tests/profile.test.js`, `tests/backup.test.js`

**Interfaces:**
- Produces:
  - `computeBmi(weightKg, heightCm): number|null`(小数1位に丸め。非数値・0以下はnull)
  - `bmiCategory(bmi): { label, color }`
  - `loadProfile(storage): { height, targetWeight, targetWaist }`(未設定キーはnull)/ `saveProfile(storage, profile)`(キー `'weight-app:profile'`)
  - `buildBackupPayload(records, profile, now?): { version: 1, exportedAt, records, profile }`
  - `validateBackupData(data): data`(不正はthrow)

- [ ] **Step 1: 失敗するテストを書く**

`tests/bmi.test.js`:
```js
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
```

`tests/profile.test.js`:
```js
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
```

`tests/backup.test.js`:
```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(3モジュールが存在しない)

- [ ] **Step 3: 実装**

`js/bmi.js`:
```js
export function computeBmi(weightKg, heightCm) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

// 日本肥満学会の区分(簡略版)
const BMI_CATEGORIES = [
  { max: 18.5, label: '低体重', color: '#3b82f6' },
  { max: 25, label: '普通体重', color: '#059669' },
  { max: 30, label: '肥満(1度)', color: '#facc15' },
  { max: Infinity, label: '肥満(2度以上)', color: '#ef4444' },
];

export function bmiCategory(bmi) {
  return BMI_CATEGORIES.find((c) => bmi < c.max);
}
```

`js/profile.js`:
```js
const KEY = 'weight-app:profile';
const EMPTY = { height: null, targetWeight: null, targetWaist: null };

export function loadProfile(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProfile(storage, profile) {
  storage.setItem(KEY, JSON.stringify({ ...EMPTY, ...profile }));
}
```

`js/backup.js`:
```js
export function buildBackupPayload(records, profile, now = new Date()) {
  return { version: 1, exportedAt: now.toISOString(), records, profile };
}

export function validateBackupData(data) {
  if (!data || data.version !== 1) throw new Error('バックアップデータの形式が不正です(version)');
  if (!Array.isArray(data.records)) throw new Error('バックアップデータの形式が不正です(records)');
  return data;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add js/bmi.js js/profile.js js/backup.js tests/bmi.test.js tests/profile.test.js tests/backup.test.js
git commit -m "feat: BMI計算・プロフィール・バックアップの純粋ロジック"
```

---

### Task 4: chart(SVG折れ線グラフ)

**Files:**
- Create: `js/chart.js`, `tests/chart.test.js`
- 参考実装: `D:\Obsidian Vault for Claude Code\Git\血圧手帳アプリ\js\bpChart.js`(monotone補間・横スクロールのロジックはここから流用)

**Interfaces:**
- Consumes: なし(純粋関数のみ)
- Produces:
  - `computeAxis(values: number[]): { bottom, top, step }`
  - `monotonePath(points: {x,y}[]): string`(SVG path d属性。1点以下は空文字)
  - `buildLineChartSvg(points: {date: 'YYYY-MM-DD', value: number}[], opts: { target?: number|null, unit?: string, color?: string }): string`(SVG文字列。targetがあれば赤点線の目標線)

- [ ] **Step 1: 失敗するテストを書く**

`tests/chart.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAxis, monotonePath, buildLineChartSvg } from '../js/chart.js';

test('computeAxis: データを含む範囲と適切なstepを返す', () => {
  const axis = computeAxis([55, 57, 56]);
  assert.ok(axis.bottom < 55);
  assert.ok(axis.top > 57);
  assert.equal(axis.step, 0.5);
});

test('computeAxis: 広い範囲ではstepが大きくなる', () => {
  const axis = computeAxis([50, 90]);
  assert.equal(axis.step, 5);
});

test('monotonePath: 2点ならMで始まりCを含む', () => {
  const d = monotonePath([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  assert.ok(d.startsWith('M 0,0'));
  assert.ok(d.includes('C'));
});

test('monotonePath: 1点以下は空文字', () => {
  assert.equal(monotonePath([]), '');
  assert.equal(monotonePath([{ x: 1, y: 1 }]), '');
});

test('buildLineChartSvg: svg要素で、目標指定時は点線を含む', () => {
  const points = [{ date: '2026-08-01', value: 57 }, { date: '2026-08-02', value: 56.5 }];
  const withTarget = buildLineChartSvg(points, { target: 56, unit: 'kg' });
  assert.ok(withTarget.startsWith('<svg'));
  assert.ok(withTarget.includes('stroke-dasharray'));
  const noTarget = buildLineChartSvg(points, {});
  assert.ok(!noTarget.includes('stroke-dasharray'));
});

test('buildLineChartSvg: 1点でも例外なく描ける', () => {
  const svg = buildLineChartSvg([{ date: '2026-08-01', value: 57 }], {});
  assert.ok(svg.startsWith('<svg'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(`js/chart.js` が存在しない)

- [ ] **Step 3: 実装**

`js/chart.js`(computeTangents/monotonePath/computeViewWidthは血圧手帳bpChart.jsの流用):
```js
const VIEW_HEIGHT = 360;
const PLOT_LEFT = 42;
const RIGHT_MARGIN = 10;
const MIN_VIEW_WIDTH = 374; // 30点以下はこの固定幅
const PLOT_TOP = 10;
const PLOT_BOTTOM = 305; // 下側はx軸ラベル用の余白
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const SPACING_30 = (364 - PLOT_LEFT) / 29; // 30点表示時の点間隔
const X_LABEL_MIN_GAP = 45;
const X_LABEL_Y = 330;
const Y_LABEL_X = 34;
const AXIS_LABEL_COLOR = '#9ca3af';

function computeViewWidth(n) {
  if (n <= 30) return MIN_VIEW_WIDTH;
  return PLOT_LEFT + (n - 1) * SPACING_30 + RIGHT_MARGIN;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function toMonthDay(dateStr) {
  const [, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

function sign(n) {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

// データ全体を含む範囲を、5〜8本程度のグリッドになるstepで丸める。
export function computeAxis(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.1);
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => span / s <= 8) ?? 100;
  const bottom = round1(Math.floor(min / step) * step - step);
  const top = round1(Math.ceil(max / step) * step + step);
  return { bottom, top, step };
}

// Fritsch-Carlson法(d3-shape/Rechartsのtype="monotone"相当)。
// オーバーシュートせず、隣接2点の範囲を超えて振れないのが特徴。
function computeTangents(points) {
  const n = points.length;
  const t = new Array(n).fill(0);
  if (n < 2) return t;

  if (n === 2) {
    const dx = points[1].x - points[0].x;
    const m = dx === 0 ? 0 : (points[1].y - points[0].y) / dx;
    t[0] = m;
    t[1] = m;
    return t;
  }

  for (let i = 1; i < n - 1; i++) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = h0 === 0 ? 0 : (points[i].y - points[i - 1].y) / h0;
    const s1 = h1 === 0 ? 0 : (points[i + 1].y - points[i].y) / h1;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    const sgn = sign(s0) + sign(s1);
    t[i] = sgn === 0 ? 0 : sgn * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
  }

  const h0 = points[1].x - points[0].x;
  t[0] = h0 === 0 ? t[1] : (3 * (points[1].y - points[0].y) / h0 - t[1]) / 2;
  const hLast = points[n - 1].x - points[n - 2].x;
  t[n - 1] = hLast === 0 ? t[n - 2] : (3 * (points[n - 1].y - points[n - 2].y) / hLast - t[n - 2]) / 2;

  return t;
}

// monotone cubic補間によるSVGパスのd属性を返す純粋関数。点が1個以下なら空文字。
export function monotonePath(points) {
  if (points.length < 2) return '';

  const t = computeTangents(points);
  let d = `M ${round2(points[0].x)},${round2(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const x1 = points[i].x + dx / 3;
    const y1 = points[i].y + (t[i] * dx) / 3;
    const x2 = points[i + 1].x - dx / 3;
    const y2 = points[i + 1].y - (t[i + 1] * dx) / 3;
    d += ` C ${round2(x1)},${round2(y1)} ${round2(x2)},${round2(y2)} ${round2(points[i + 1].x)},${round2(points[i + 1].y)}`;
  }
  return d;
}

export function buildLineChartSvg(points, { target = null, unit = '', color = '#059669' } = {}) {
  const values = points.map((p) => p.value);
  if (target != null) values.push(target);
  const axis = computeAxis(values);
  const span = axis.top - axis.bottom;
  const n = points.length;
  const viewWidth = computeViewWidth(n);
  const plotRight = viewWidth - RIGHT_MARGIN;
  const plotWidth = plotRight - PLOT_LEFT;

  const xFor = (i) => (n === 1 ? (PLOT_LEFT + plotRight) / 2 : PLOT_LEFT + (i / (n - 1)) * plotWidth);
  const yFor = (value) => PLOT_TOP + PLOT_HEIGHT * (1 - (value - axis.bottom) / span);

  // 水平グリッド線と数値ラベル(浮動小数の蓄積誤差をround1で吸収)
  let grid = '';
  for (let v = axis.bottom; v <= axis.top + 1e-9; v = round1(v + axis.step)) {
    const y = round2(yFor(v));
    const label = axis.step < 1 ? v.toFixed(1) : String(v);
    grid += `<line class="chart-grid" x1="${PLOT_LEFT}" y1="${y}" x2="${round2(plotRight)}" y2="${y}" />`;
    grid += `<text class="chart-axis-label" x="${Y_LABEL_X}" y="${round2(y + 3)}" text-anchor="end" fill="${AXIS_LABEL_COLOR}">${label}</text>`;
  }

  // 目標線(赤の点線)
  let targetLine = '';
  if (target != null) {
    const y = round2(yFor(target));
    targetLine = `<line x1="${PLOT_LEFT}" y1="${y}" x2="${round2(plotRight)}" y2="${y}" style="stroke:#ef4444; stroke-width:1.5; stroke-dasharray:4 4;" />`;
  }

  const xy = points.map((p, i) => ({ x: round2(xFor(i)), y: round2(yFor(p.value)) }));
  const d = monotonePath(xy);
  const path = d ? `<path d="${d}" style="stroke:${color}; stroke-width:2.5; fill:none; stroke-linejoin:round; stroke-linecap:round;" />` : '';
  const dots = xy
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" style="fill:#fff; stroke:${color}; stroke-width:2.5;" />`)
    .join('');

  // x軸ラベルは最低45px間隔になるよう間引く(線とドットは全点描く)
  const spacing = n > 1 ? plotWidth / (n - 1) : 0;
  const interval = n > 1 ? Math.max(1, Math.ceil(X_LABEL_MIN_GAP / spacing)) : 1;
  const xLabels = points
    .map((p, i) => {
      if (i % interval !== 0 && i !== n - 1) return '';
      return `<text class="chart-axis-label" x="${round2(xFor(i))}" y="${X_LABEL_Y}" text-anchor="middle" fill="${AXIS_LABEL_COLOR}">${toMonthDay(p.date)}</text>`;
    })
    .join('');

  const first = toMonthDay(points[0].date);
  const last = toMonthDay(points[n - 1].date);
  // 31点以上で幅が374を超えるときだけmin-widthを付け、横スクロールで全点を見せる
  const minWidthAttr = viewWidth > MIN_VIEW_WIDTH ? ` style="min-width:${round2(viewWidth)}px"` : '';

  return `<svg class="line-chart" viewBox="0 0 ${round2(viewWidth)} ${VIEW_HEIGHT}" width="100%"${minWidthAttr} role="img" aria-label="${first}から${last}までの推移(${unit})">
  ${grid}
  ${targetLine}
  ${path}
  ${dots}
  ${xLabels}
</svg>`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add js/chart.js tests/chart.test.js
git commit -m "feat: SVG折れ線グラフ(目標線・横スクロール対応)"
```

---

### Task 5: UI一式(3タブ・記録フォーム・履歴・グラフ・設定)

**Files:**
- Create: `index.html`, `style.css`, `js/app.js`, `js/recordForm.js`, `js/graphView.js`, `js/settingsView.js`, `tools/serve.js`
- 参考実装: `D:\Obsidian Vault for Claude Code\Git\血圧手帳アプリ\style.css`(スタイルのベース。丸ごとコピーして下記の通り調整する)

**Interfaces:**
- Consumes: Task 1〜4 の全export(シグネチャは各タスクのProduces参照)
- Produces: `renderRecordView(container)`, `renderGraphView(container)`, `renderSettingsView(container)`(いずれもDOM要素を受けて描画)

- [ ] **Step 1: index.html を作成**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>体重・腹囲手帳</title>
<meta name="theme-color" content="#059669">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="app-header">
  <div class="app-title">
    <h1>体重・腹囲手帳</h1>
    <span class="app-subtitle">毎日の体重と腹囲を記録</span>
  </div>
</header>

<main id="view-record" class="view"></main>
<main id="view-graph" class="view hidden"></main>
<main id="view-settings" class="view hidden"></main>

<nav class="app-nav">
  <button data-view="record" class="nav-btn is-active">
    <span class="nav-icon">✚</span>記録
  </button>
  <button data-view="graph" class="nav-btn">
    <span class="nav-icon">📈</span>グラフ
  </button>
  <button data-view="settings" class="nav-btn">
    <span class="nav-icon">⚙</span>設定
  </button>
</nav>

<script type="module" src="js/app.js"></script>
</body>
</html>
```

※ manifest.json と icons/ は Task 6 で作る。この時点で404になるが動作に支障はない。

- [ ] **Step 2: style.css を作成**

血圧手帳の `style.css` をコピーし、以下を調整する:
1. アクセントカラー `#12787D` 系をすべて `#059669` 系に置換(`#0d9488` などteal系の派生色も同系のエメラルドに)
2. 血圧手帳固有のクラスを削除: `.dial` `.stepper-row` `.step-btn` `.slider-wrap` `.ruler` `.arm-card` `.arm-head` `.arm-name` `.arm-tag` `.cat-badge` `.bp-readout` `.readout-*` `.avg-cards` `.avg-*` `.dist-*` `.bp-chart` `.bp-grid` `.bp-axis-label`
3. 以下を追加:

```css
/* 入力フィールド */
.field {
  display: block;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}
.field input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 12px;
  font-size: 18px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
}
.field input:focus {
  outline: 2px solid #059669;
  border-color: transparent;
}

/* BMIプレビュー */
.bmi-preview {
  margin: 4px 0 14px;
  padding: 12px;
  border-radius: 10px;
  background: #f0fdf4;
  font-size: 14px;
  color: #475569;
}
.bmi-preview b {
  font-size: 20px;
  margin-right: 6px;
}
.bmi-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  background: var(--cat-color, #059669);
}

/* 履歴一覧 */
.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.history-row {
  padding: 10px 2px;
  border-bottom: 1px solid #e2e8f0;
}
.history-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.history-date {
  font-size: 13px;
  color: #64748b;
  flex-shrink: 0;
}
.history-vals {
  flex: 1;
  font-size: 14px;
}
.history-vals b {
  font-size: 17px;
}
.history-bmi {
  margin-left: 8px;
  font-size: 12px;
  color: #64748b;
}
.history-memo {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}
.delete-btn {
  border: 1px solid #fca5a5;
  background: #fff;
  color: #dc2626;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}
.muted { color: #94a3b8; }

/* 期間切替(セグメントコントロール) */
.seg-control {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}
.seg-btn {
  flex: 1;
  padding: 10px 0;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}
.seg-btn.is-active {
  background: #059669;
  border-color: #059669;
  color: #fff;
  font-weight: 700;
}

/* グラフ */
.chart-scroll {
  overflow-x: auto;
}
.line-chart {
  display: block;
}
.chart-grid {
  stroke: #e2e8f0;
  stroke-width: 1;
}
.chart-axis-label {
  font-size: 11px;
}
```

※ `.panel` `.panel-title` `.panel-note` `.save-btn` `.save-message` `.empty-state` `.empty-title` `.date-field` `.app-header` `.app-nav` `.nav-btn` `.view` `.hidden` は血圧手帳のものをそのまま使う(コピー元に含まれている)。

- [ ] **Step 3: recordForm を実装**

`js/recordForm.js`:
```js
import { computeBmi, bmiCategory } from './bmi.js';
import { formatDate } from './dateUtils.js';
import { loadRecords, saveRecords, upsertRecord, deleteRecord } from './records.js';
import { loadProfile } from './profile.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function bmiPreviewHtml(weight, height) {
  if (!height) return '設定タブで身長を入力するとBMIが自動計算されます';
  const bmi = computeBmi(weight, height);
  if (bmi == null) return '体重を入力するとBMIを表示します';
  const cat = bmiCategory(bmi);
  return `BMI <b>${bmi.toFixed(1)}</b><span class="bmi-tag" style="--cat-color:${cat.color}">${cat.label}</span>`;
}

function historyHtml(records, height) {
  if (records.length === 0) {
    return `<div class="empty-state">
      <p class="empty-title">記録がありません</p>
      <p>上のフォームから本日の体重と腹囲を記録しましょう。</p>
    </div>`;
  }
  const rows = [...records].reverse().map((r) => {
    const bmi = r.weight != null && height ? computeBmi(r.weight, height) : null;
    const weight = r.weight != null ? `<b>${r.weight.toFixed(1)}</b>kg` : '<span class="muted">—</span>';
    const waist = r.waist != null ? `<b>${r.waist.toFixed(1)}</b>cm` : '<span class="muted">—</span>';
    return `<li class="history-row">
      <div class="history-main">
        <span class="history-date">${r.date}</span>
        <span class="history-vals">${weight} / ${waist}${bmi != null ? `<span class="history-bmi">BMI ${bmi.toFixed(1)}</span>` : ''}</span>
        <button type="button" class="delete-btn" data-date="${r.date}">削除</button>
      </div>
      ${r.memo ? `<p class="history-memo">${escapeHtml(r.memo)}</p>` : ''}
    </li>`;
  }).join('');
  return `<p class="panel-note">累計 ${records.length} 件</p><ul class="history-list">${rows}</ul>`;
}

export function renderRecordView(container) {
  const today = formatDate(new Date());
  const profile = loadProfile(localStorage);

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">新規記録</h2>
      <label class="field">記録日
        <input type="date" id="record-date" value="${today}" max="${today}">
      </label>
      <label class="field">体重 (kg)
        <input type="number" id="record-weight" inputmode="decimal" step="0.1" min="1" max="300" placeholder="例: 56.0">
      </label>
      <div class="bmi-preview" id="bmi-preview"></div>
      <label class="field">腹囲 (cm)
        <input type="number" id="record-waist" inputmode="decimal" step="0.1" min="1" max="300" placeholder="例: 75.0">
      </label>
      <label class="field">メモ (任意)
        <input type="text" id="record-memo" placeholder="体調や食事、運動メモなど">
      </label>
      <button type="button" id="save-record" class="save-btn">データを保存する</button>
      <p id="save-message" class="save-message" role="status"></p>
    </section>
    <section class="panel">
      <h2 class="panel-title">記録履歴</h2>
      <div id="history-area"></div>
    </section>
  `;

  const dateInput = container.querySelector('#record-date');
  const weightInput = container.querySelector('#record-weight');
  const waistInput = container.querySelector('#record-waist');
  const memoInput = container.querySelector('#record-memo');
  const saveBtn = container.querySelector('#save-record');
  const message = container.querySelector('#save-message');
  const bmiPreview = container.querySelector('#bmi-preview');
  const historyArea = container.querySelector('#history-area');

  function refreshHistory() {
    historyArea.innerHTML = historyHtml(loadRecords(localStorage), profile.height);
  }

  function refreshBmi() {
    bmiPreview.innerHTML = bmiPreviewHtml(Number(weightInput.value), profile.height);
  }

  function loadDate(date) {
    const existing = loadRecords(localStorage).find((r) => r.date === date) || null;
    weightInput.value = existing && existing.weight != null ? existing.weight : '';
    waistInput.value = existing && existing.waist != null ? existing.waist : '';
    memoInput.value = existing && existing.memo ? existing.memo : '';
    saveBtn.textContent = existing ? 'この日の記録を更新する' : 'データを保存する';
    message.textContent = '';
    refreshBmi();
  }

  // 数値入力の解釈: 空欄はnull、数値でない・範囲外はエラー(文字列を返す)
  function parseMeasure(input, name) {
    if (input.value.trim() === '') return null;
    const v = Number(input.value);
    if (!Number.isFinite(v) || v <= 0 || v > 300) return `${name}は0〜300の数値で入力してください`;
    return Math.round(v * 10) / 10;
  }

  weightInput.addEventListener('input', refreshBmi);
  dateInput.addEventListener('change', () => {
    if (dateInput.value) loadDate(dateInput.value);
  });

  saveBtn.addEventListener('click', () => {
    const weight = parseMeasure(weightInput, '体重');
    const waist = parseMeasure(waistInput, '腹囲');
    for (const v of [weight, waist]) {
      if (typeof v === 'string') {
        message.textContent = v;
        return;
      }
    }
    if (weight == null && waist == null) {
      message.textContent = '体重か腹囲のどちらかを入力してください';
      return;
    }
    const record = {
      date: dateInput.value,
      weight,
      waist,
      memo: memoInput.value.trim() || null,
      createdAt: new Date().toISOString(),
    };
    saveRecords(localStorage, upsertRecord(loadRecords(localStorage), record));
    message.textContent = '記録を保存しました。';
    saveBtn.textContent = 'この日の記録を更新する';
    refreshHistory();
  });

  historyArea.addEventListener('click', (event) => {
    const btn = event.target.closest('.delete-btn');
    if (!btn) return;
    if (!confirm(`${btn.dataset.date} の記録を削除しますか?`)) return;
    saveRecords(localStorage, deleteRecord(loadRecords(localStorage), btn.dataset.date));
    refreshHistory();
    loadDate(dateInput.value);
  });

  loadDate(today);
  refreshHistory();
}
```

- [ ] **Step 4: graphView を実装**

`js/graphView.js`:
```js
import { buildLineChartSvg } from './chart.js';
import { formatDate, shiftDate } from './dateUtils.js';
import { loadRecords, filterFromDate } from './records.js';
import { loadProfile } from './profile.js';

const PERIODS = [
  { id: '1m', label: '1ヶ月', days: 30 },
  { id: '3m', label: '3ヶ月', days: 90 },
  { id: 'all', label: '全期間', days: null },
];

function chartSection(title, points, target, unit, color) {
  if (points.length === 0) {
    return `<section class="panel">
      <h2 class="panel-title">${title}</h2>
      <div class="empty-state"><p>この期間の記録がありません</p></div>
    </section>`;
  }
  return `<section class="panel">
    <h2 class="panel-title">${title}</h2>
    <div class="chart-scroll">${buildLineChartSvg(points, { target, unit, color })}</div>
    ${target != null ? `<p class="panel-note">赤の点線は目標(${target}${unit})</p>` : ''}
  </section>`;
}

export function renderGraphView(container) {
  const state = { period: '1m' };

  function render() {
    const today = formatDate(new Date());
    const period = PERIODS.find((p) => p.id === state.period);
    const all = loadRecords(localStorage);
    const records = period.days != null ? filterFromDate(all, shiftDate(today, -period.days)) : all;
    const profile = loadProfile(localStorage);
    const weightPoints = records.filter((r) => r.weight != null).map((r) => ({ date: r.date, value: r.weight }));
    const waistPoints = records.filter((r) => r.waist != null).map((r) => ({ date: r.date, value: r.waist }));

    const buttons = PERIODS.map((p) =>
      `<button type="button" class="seg-btn ${p.id === state.period ? 'is-active' : ''}" data-period="${p.id}">${p.label}</button>`
    ).join('');

    container.innerHTML = `
      <div class="seg-control">${buttons}</div>
      ${chartSection('体重の推移', weightPoints, profile.targetWeight, 'kg', '#059669')}
      ${chartSection('腹囲の推移', waistPoints, profile.targetWaist, 'cm', '#0ea5e9')}
    `;

    container.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.period = btn.dataset.period;
        render();
      });
    });
    // 横スクロールを最新日付側(右端)に合わせる
    container.querySelectorAll('.chart-scroll').forEach((el) => {
      el.scrollLeft = el.scrollWidth;
    });
  }

  render();
}
```

- [ ] **Step 5: settingsView を実装**

`js/settingsView.js`:
```js
import { loadRecords, saveRecords, mergeRecords } from './records.js';
import { loadProfile, saveProfile } from './profile.js';
import { buildBackupPayload, validateBackupData } from './backup.js';
import { formatDate } from './dateUtils.js';

export function renderSettingsView(container) {
  const profile = loadProfile(localStorage);
  const val = (v) => (v == null ? '' : String(v));

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">プロフィール & 目標</h2>
      <label class="field">身長 (cm)
        <input type="number" id="profile-height" inputmode="decimal" step="0.1" min="50" max="250" value="${val(profile.height)}" placeholder="例: 170.0">
      </label>
      <p class="panel-note">体重を入力した際、この身長を基準にBMIが自動計算されます。</p>
      <label class="field">目標体重 (kg)
        <input type="number" id="profile-target-weight" inputmode="decimal" step="0.1" min="1" max="300" value="${val(profile.targetWeight)}" placeholder="例: 56.0">
      </label>
      <label class="field">目標腹囲 (cm) (任意)
        <input type="number" id="profile-target-waist" inputmode="decimal" step="0.1" min="1" max="300" value="${val(profile.targetWaist)}" placeholder="例: 75.0">
      </label>
      <p class="panel-note">目標はグラフに赤の点線で表示されます。</p>
      <button type="button" id="save-profile" class="save-btn">設定を保存する</button>
      <p id="profile-message" class="save-message" role="status"></p>
    </section>
    <section class="panel">
      <h2 class="panel-title">データについて</h2>
      <p class="panel-note">記録はこの端末(ブラウザ)に保存され、1日1回GitHubにも自動バックアップされます。
      機種変更のときは、新しい端末でトークンを設定して「GitHubから復元」してください。</p>
    </section>
    <section class="panel" id="backup-section"></section>
    <section class="panel">
      <h2 class="panel-title">ファイルへのバックアップ</h2>
      <p class="panel-note">記録と設定をファイルに書き出したり、ファイルから取り込んだりできます。</p>
      <button type="button" id="export-file-btn" class="save-btn">ファイルにエクスポート</button>
      <button type="button" id="import-file-btn" class="save-btn">ファイルからインポート</button>
      <input type="file" id="import-file-input" accept="application/json" hidden>
      <p id="file-backup-message" class="save-message" role="status"></p>
    </section>
  `;

  const message = container.querySelector('#profile-message');
  const fileMessage = container.querySelector('#file-backup-message');
  const importInput = container.querySelector('#import-file-input');

  // 空欄はnull、数値でない・0以下はエラー(文字列を返す)
  function parseField(id, name) {
    const input = container.querySelector(id);
    if (input.value.trim() === '') return null;
    const v = Number(input.value);
    if (!Number.isFinite(v) || v <= 0) return `${name}は正の数値で入力してください`;
    return Math.round(v * 10) / 10;
  }

  container.querySelector('#save-profile').addEventListener('click', () => {
    const height = parseField('#profile-height', '身長');
    const targetWeight = parseField('#profile-target-weight', '目標体重');
    const targetWaist = parseField('#profile-target-waist', '目標腹囲');
    for (const v of [height, targetWeight, targetWaist]) {
      if (typeof v === 'string') {
        message.textContent = v;
        return;
      }
    }
    saveProfile(localStorage, { height, targetWeight, targetWaist });
    message.textContent = '設定を保存しました。';
  });

  container.querySelector('#export-file-btn').addEventListener('click', () => {
    const payload = buildBackupPayload(loadRecords(localStorage), loadProfile(localStorage));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weight-app-backup-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector('#import-file-btn').addEventListener('click', () => {
    importInput.click();
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      validateBackupData(data);
      const merged = mergeRecords(loadRecords(localStorage), data.records);
      saveRecords(localStorage, merged);
      if (data.profile && typeof data.profile === 'object') {
        saveProfile(localStorage, { ...loadProfile(localStorage), ...data.profile });
      }
      fileMessage.textContent = `${data.records.length}件を取り込みました(現在の合計${merged.length}件)`;
    } catch {
      fileMessage.textContent = 'ファイルの形式が正しくありません。';
    }
  });

  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => sync.renderSyncSettings(container.querySelector('#backup-section')))
    .catch(() => {
      container.querySelector('#backup-section').innerHTML =
        '<p class="panel-note">バックアップ機能は現在利用できません(オフラインの可能性)。</p>';
    });
}
```

- [ ] **Step 6: app.js を実装**

`js/app.js`:
```js
import { renderRecordView } from './recordForm.js';
import { renderGraphView } from './graphView.js';
import { renderSettingsView } from './settingsView.js';
import { loadRecords, saveRecords } from './records.js';
import { loadProfile, saveProfile } from './profile.js';
import { buildBackupPayload, validateBackupData } from './backup.js';

function switchView(viewName) {
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  }
  for (const btn of document.querySelectorAll('.nav-btn')) {
    btn.classList.toggle('is-active', btn.dataset.view === viewName);
  }
  if (viewName === 'record') renderRecordView(document.getElementById('view-record'));
  if (viewName === 'graph') renderGraphView(document.getElementById('view-graph'));
  if (viewName === 'settings') renderSettingsView(document.getElementById('view-settings'));
}

function init() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  switchView('record');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 共有バックアップ基盤は動的import。オフラインやapp-sync障害時は黙ってスキップし、
  // アプリ本体の起動を妨げない(次回オンライン起動時に再試行される)。
  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => sync.initDailyBackup({
      appId: 'weight-app',
      collect: async () => buildBackupPayload(loadRecords(localStorage), loadProfile(localStorage)),
      restore: async (data) => {
        validateBackupData(data);
        saveRecords(localStorage, data.records);
        if (data.profile && typeof data.profile === 'object') saveProfile(localStorage, data.profile);
      },
    }))
    .catch(() => {});
}

init();
```

- [ ] **Step 7: tools/serve.js を作成**

血圧手帳の `tools/serve.js` をコピーし、`const port = 8123;` を `const port = 8124;` に変更するだけ。

- [ ] **Step 8: 全テストが通ることを確認**

Run: `npm test`
Expected: PASS(既存テスト全件。このタスクでは新規テストなし — UIの動作確認は本体セッションがブラウザで行う)

- [ ] **Step 9: コミット**

```bash
git add index.html style.css js/app.js js/recordForm.js js/graphView.js js/settingsView.js tools/serve.js
git commit -m "feat: 3タブUI(記録・グラフ・設定)"
```

---

### Task 6: PWA化(manifest・アイコン・sw.js・整合性テスト)

**Files:**
- Create: `manifest.json`, `icons/icon.svg`, `tools/makeIcons.js`, `sw.js`, `tests/pwaAssets.test.js`
- Generate: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`

**Interfaces:**
- Consumes: js/ 配下の全ファイル名(sw.jsのASSETSに列挙する)

- [ ] **Step 1: 失敗するテストを書く**

`tests/pwaAssets.test.js`(血圧手帳と同一ロジック):
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// sw.jsのASSETS配列を文字列として抜き出す(sw.jsはself前提でimportできないため)
function swAssets() {
  const m = swSource.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'sw.jsにASSETS配列がある');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1].replace(/^\.\//, ''));
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('manifest: PNGアイコン3種(192/512/maskable)が宣言されている', () => {
  const srcs = manifest.icons.map((i) => i.src);
  assert.ok(srcs.includes('icons/icon-192.png'));
  assert.ok(srcs.includes('icons/icon-512.png'));
  assert.ok(srcs.includes('icons/icon-maskable-512.png'));
  const maskable = manifest.icons.find((i) => i.src === 'icons/icon-maskable-512.png');
  assert.equal(maskable.purpose, 'maskable');
});

test('manifest: 宣言された全アイコンファイルが実在する', () => {
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src + ' が存在する');
  }
});

test('manifest: PNGアイコンの実寸がsizes宣言と一致する', () => {
  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(fs.readFileSync(path.join(root, icon.src)));
    assert.deepEqual(actual, { width: w, height: h }, icon.src);
  }
});

test('sw.js: manifestの全アイコンがASSETSに含まれる', () => {
  const assets = swAssets();
  for (const icon of manifest.icons) {
    assert.ok(assets.includes(icon.src), icon.src + ' がASSETSにある');
  }
});

test('sw.js: js配下の全モジュールがASSETSに含まれる', () => {
  const assets = swAssets();
  for (const file of fs.readdirSync(path.join(root, 'js'))) {
    assert.ok(assets.includes(`js/${file}`), `js/${file} がASSETSにある`);
  }
});

test('sw.js: app-syncの共有モジュールURLをキャッシュしていない', () => {
  assert.ok(!swSource.includes('github.io/app-sync'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL(manifest.json が存在しない)

- [ ] **Step 3: manifest.json と icon.svg を作成**

`manifest.json`:
```json
{
  "name": "体重・腹囲手帳",
  "short_name": "体重手帳",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#F1F4F5",
  "theme_color": "#059669",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`icons/icon.svg`(体重計のダイアルをモチーフ):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="100" height="100" rx="18" fill="#059669"/>
  <circle cx="50" cy="50" r="28" fill="none" stroke="#fff" stroke-width="5.5"/>
  <rect x="47.75" y="30" width="4.5" height="24" rx="2.25" fill="#fff"/>
</svg>
```

- [ ] **Step 4: PNGアイコン生成スクリプトを作成して実行**

`tools/makeIcons.js`(依存なしのPNGエンコーダ。icon.svgと同じモチーフを手続き的に描く):
```js
// 一度だけ使うアイコン生成スクリプト: node tools/makeIcons.js
// icons/ に icon-192.png / icon-512.png / icon-maskable-512.png を生成する(依存なし)。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const iconsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [5, 150, 105]; // #059669
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 体重計のダイアルモチーフ: 角丸正方形の背景 + 白いリング + 12時方向の針
function drawIcon(size, { maskable }) {
  const c = size / 2;
  const corner = size * 0.18;
  const scale = maskable ? 0.72 : 0.92; // maskableはセーフゾーン(中央80%)に収める
  const ringR = size * 0.3 * scale;
  const ringW = size * 0.055 * scale;
  const needleW = size * 0.045 * scale;
  const needleTop = c - ringR * 0.72;
  return (x, y) => {
    if (!maskable) {
      // 角丸判定(maskableは全面塗り)
      const rx = Math.max(Math.abs(x - c) - (c - corner), 0);
      const ry = Math.max(Math.abs(y - c) - (c - corner), 0);
      if (rx * rx + ry * ry > corner * corner) return [0, 0, 0, 0];
    }
    const d = Math.hypot(x - c, y - c);
    if (Math.abs(d - ringR) <= ringW) return [...FG, 255];
    if (Math.abs(x - c) <= needleW && y >= needleTop && y <= c + needleW) return [...FG, 255];
    return [...BG, 255];
  };
}

fs.mkdirSync(iconsDir, { recursive: true });
for (const { name, size, maskable } of [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]) {
  fs.writeFileSync(path.join(iconsDir, name), encodePng(size, drawIcon(size, { maskable })));
  console.log('wrote', name);
}
```

Run: `node tools/makeIcons.js`
Expected: `wrote icon-192.png` など3行、icons/ にPNG3枚生成

- [ ] **Step 5: sw.js を作成**

```js
const CACHE_NAME = 'weight-app-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/backup.js',
  './js/bmi.js',
  './js/chart.js',
  './js/dateUtils.js',
  './js/graphView.js',
  './js/profile.js',
  './js/recordForm.js',
  './js/records.js',
  './js/settingsView.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
// 注意: app-sync(共有モジュール)のURLはキャッシュしない。
// オフライン時はどのみち保存できず、キャッシュすると更新が届かなくなるため。

self.addEventListener('install', (event) => {
  // cache:'reload'でブラウザHTTPキャッシュを迂回する。素のaddAllだと、
  // 古いHTTPキャッシュの内容が新しいキャッシュ名の箱に入り込み、
  // 以後どれだけ再起動しても旧版が配信され続ける事故が起きる。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npm test`
Expected: PASS(全件、pwaAssets 6件を含む)

- [ ] **Step 7: コミット**

```bash
git add manifest.json icons sw.js tools/makeIcons.js tests/pwaAssets.test.js
git commit -m "feat: PWA化(manifest・アイコン・Service Worker)"
```

---

### Task 7: README・GitHub公開(★本体セッションが実施する — サブエージェントに委譲しない)

**Files:**
- Create: `README.md`
- Modify: `D:\Obsidian Vault for Claude Code\.claude\launch.json`(weight-appエントリ追加)

- [ ] **Step 1: README.md を作成**

```markdown
# 体重・腹囲手帳 (weight-app)

体重(kg)と腹囲(cm)を記録するPWA。BMI自動計算・推移グラフ(目標線付き)・GitHub自動バックアップ対応。

- 公開URL: https://taka070600538-tech.github.io/weight-app/
- バックアップ先: 非公開リポジトリ `app-data` の `weight-app/backup.json`(app-sync共通基盤)

## 開発

- テスト: `npm test`
- ローカル確認: `node tools/serve.js` → http://localhost:8124
- sw.js の ASSETS と CACHE_NAME の更新を忘れない(pwaAssets.test.js が整合性を検証する)
```

- [ ] **Step 2: 全テスト実行と動作確認(本体がブラウザで検証)**

Run: `npm test` → 全件PASS
ブラウザ確認: 記録保存 → 履歴表示 → グラフ表示 → 設定保存 → BMIプレビュー

- [ ] **Step 3: launch.json に weight-app エントリを追加**

`.claude/launch.json` の configurations に追加:
```json
{
  "name": "weight-app",
  "runtimeExecutable": "node",
  "runtimeArgs": ["Git/体重腹囲アプリ/tools/serve.js"],
  "port": 8124
}
```

- [ ] **Step 4: GitHubリポジトリ作成・push・Pages有効化**

```bash
git add README.md
git commit -m "docs: README追加"
gh repo create weight-app --public --source . --push
gh api repos/taka070600538-tech/weight-app/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

Expected: https://taka070600538-tech.github.io/weight-app/ が数分後に配信開始

---

## 検証フェーズ(本体セッション、計画外の必須作業)

1. `npm test` を本体が実行し直して全件PASSを確認
2. ブラウザ(preview: weight-app)で記録→履歴→グラフ→設定の一連の操作を確認
3. モバイル表示(375px)での崩れがないか確認
4. Pages公開後、実URLでの動作確認
