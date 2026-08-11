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

test('buildLineChartSvg: 60日以上のギャップがあると点線(stroke-dasharray="6 6")が出る', () => {
  const points = [
    { date: '2026-01-01', value: 57 },
    { date: '2026-01-05', value: 56.5 },
    { date: '2026-04-01', value: 55 },
  ];
  const svg = buildLineChartSvg(points, {});
  assert.ok(svg.includes('stroke-dasharray="6 6"'));
});

test('buildLineChartSvg: ギャップがないデータでは点線(stroke-dasharray="6 6")が出ない', () => {
  const points = [
    { date: '2026-08-01', value: 57 },
    { date: '2026-08-02', value: 56.5 },
    { date: '2026-08-03', value: 56 },
  ];
  const svg = buildLineChartSvg(points, {});
  assert.ok(!svg.includes('stroke-dasharray="6 6"'));
});

test('buildLineChartSvg: daysPerScreen=365で1年超のデータはmin-widthが付く', () => {
  const points = [
    { date: '2025-01-01', value: 57 },
    { date: '2026-08-01', value: 55 },
  ];
  const svg = buildLineChartSvg(points, { daysPerScreen: 365 });
  const match = svg.match(/min-width:([\d.]+)px/);
  assert.ok(match);
  assert.ok(Number(match[1]) > 374);
});

test('buildLineChartSvg: daysPerScreen=365で1年未満のデータは固定幅374', () => {
  const points = [
    { date: '2026-08-01', value: 57 },
    { date: '2026-08-10', value: 56 },
  ];
  const svg = buildLineChartSvg(points, { daysPerScreen: 365 });
  assert.ok(!svg.includes('min-width'));
  assert.ok(svg.includes('viewBox="0 0 374 360"'));
});
