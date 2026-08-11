import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAxis, monotonePath, buildChartHtml } from '../js/chart.js';

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

test('buildChartHtml: chart-area > chart-yaxis(svg) + chart-scroll > line-chart(svg) の構造を持つ', () => {
  const points = [{ date: '2026-08-01', value: 57 }, { date: '2026-08-02', value: 56.5 }];
  const html = buildChartHtml(points, {});
  assert.ok(html.startsWith('<div class="chart-area">'));
  assert.ok(html.includes('<svg class="chart-yaxis"'));
  const scrollIndex = html.indexOf('class="chart-scroll"');
  assert.ok(scrollIndex >= 0);
  const afterScroll = html.slice(scrollIndex);
  assert.ok(afterScroll.includes('<svg class="line-chart"'));
});

test('buildChartHtml: y軸の数値ラベルはchart-yaxis側、x軸の日付ラベルはline-chart側にのみ含まれる', () => {
  const points = [
    { date: '2026-08-01', value: 57 },
    { date: '2026-08-02', value: 56.5 },
    { date: '2026-08-03', value: 56 },
  ];
  const html = buildChartHtml(points, {});
  const scrollIndex = html.indexOf('class="chart-scroll"');
  const yAxisPart = html.slice(0, scrollIndex);
  const plotPart = html.slice(scrollIndex);

  // y軸側にのみ数値ラベル(chart-axis-labelかつtext-anchor="end")が出る
  assert.ok(yAxisPart.includes('chart-axis-label'));
  assert.ok(!plotPart.includes('text-anchor="end"'));

  // x軸の日付ラベル(MM/DD形式)はline-chart側にのみ出る
  assert.ok(!yAxisPart.includes('08/01'));
  assert.ok(plotPart.includes('08/01'));
});

test('buildChartHtml: 目標指定時は点線を含み、未指定時は含まない', () => {
  const points = [{ date: '2026-08-01', value: 57 }, { date: '2026-08-02', value: 56.5 }];
  const withTarget = buildChartHtml(points, { target: 56, unit: 'kg' });
  assert.ok(withTarget.includes('stroke-dasharray'));
  const noTarget = buildChartHtml(points, {});
  assert.ok(!noTarget.includes('stroke-dasharray'));
});

test('buildChartHtml: 1点でも例外なく描ける', () => {
  const html = buildChartHtml([{ date: '2026-08-01', value: 57 }], {});
  assert.ok(html.startsWith('<div class="chart-area">'));
});

test('buildChartHtml: 60日以上のギャップがあると点線(stroke-dasharray="6 6")が出る', () => {
  const points = [
    { date: '2026-01-01', value: 57 },
    { date: '2026-01-05', value: 56.5 },
    { date: '2026-04-01', value: 55 },
  ];
  const html = buildChartHtml(points, {});
  assert.ok(html.includes('stroke-dasharray="6 6"'));
});

test('buildChartHtml: ギャップがないデータでは点線(stroke-dasharray="6 6")が出ない', () => {
  const points = [
    { date: '2026-08-01', value: 57 },
    { date: '2026-08-02', value: 56.5 },
    { date: '2026-08-03', value: 56 },
  ];
  const html = buildChartHtml(points, {});
  assert.ok(!html.includes('stroke-dasharray="6 6"'));
});

test('buildChartHtml: daysPerScreen=365で1年超のデータはline-chartのwidthが298を超える', () => {
  const points = [
    { date: '2025-01-01', value: 57 },
    { date: '2026-08-01', value: 55 },
  ];
  const html = buildChartHtml(points, { daysPerScreen: 365 });
  const match = html.match(/<svg class="line-chart" width="([\d.]+)"/);
  assert.ok(match);
  assert.ok(Number(match[1]) > 298);
});

test('buildChartHtml: daysPerScreen=365で1年未満のデータはline-chartのwidthが298固定', () => {
  const points = [
    { date: '2026-08-01', value: 57 },
    { date: '2026-08-10', value: 56 },
  ];
  const html = buildChartHtml(points, { daysPerScreen: 365 });
  const match = html.match(/<svg class="line-chart" width="([\d.]+)"/);
  assert.ok(match);
  assert.equal(Number(match[1]), 298);
});

test('buildChartHtml: chartHeightオプションがchart-yaxis/line-chart両方のheight属性に反映される', () => {
  const points = [{ date: '2026-08-01', value: 57 }, { date: '2026-08-02', value: 56.5 }];
  const html = buildChartHtml(points, { chartHeight: 180 });
  assert.ok(html.includes('<svg class="chart-yaxis" width="42" height="180"'));
  assert.ok(html.includes('height="180" viewBox="0 0 298 180"'));
});
