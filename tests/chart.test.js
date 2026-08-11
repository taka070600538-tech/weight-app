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
