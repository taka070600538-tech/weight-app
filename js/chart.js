import { daysBetween } from './dateUtils.js';

const AXIS_WIDTH = 42; // y軸svgの幅
const PLOT_PAD_LEFT = 8; // プロットsvg内の左余白
const PLOT_PAD_RIGHT = 10; // プロットsvg内の右余白
const SCREEN_PLOT_WIDTH = 280; // 「1画面ぶん」のプロット幅の近似
const Y_LABEL_X = AXIS_WIDTH - 8; // y軸ラベルのx位置(text-anchor="end")
const X_LABEL_MIN_GAP = 45;
const AXIS_LABEL_COLOR = '#9ca3af';
const GAP_SEGMENT_DAYS = 60; // 2ヶ月の近似。これ以上間隔が空いたら線を分割し点線で結ぶ

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

// y軸(数値ラベル)とプロット(グリッド・線・点・x軸ラベル)を分離した2枚のsvgを持つHTML文字列を返す。
// y軸svgは横スクロールしない側に固定され、プロットsvgだけが .chart-scroll 内で横スクロールする。
// 拡縮はせず等倍ピクセルで描画する(width/height属性=viewBox寸法)。
export function buildChartHtml(points, { target = null, unit = '', color = '#059669', daysPerScreen = 365, chartHeight = 220 } = {}) {
  const values = points.map((p) => p.value);
  if (target != null) values.push(target);
  const axis = computeAxis(values);
  const span = axis.top - axis.bottom;
  const n = points.length;

  const H = chartHeight;
  const PLOT_TOP = 8;
  const PLOT_BOTTOM = H - 30; // 下側はx軸ラベル用の余白
  const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
  const X_LABEL_Y = H - 10;

  // x軸は日付に比例させる(等間隔ではない)。pxPerDayは「daysPerScreen日をSCREEN_PLOT_WIDTHに収める」密度。
  const pxPerDay = SCREEN_PLOT_WIDTH / daysPerScreen;
  const totalDays = n > 1 ? daysBetween(points[0].date, points[n - 1].date) : 0;
  const plotWidth = Math.max(SCREEN_PLOT_WIDTH + PLOT_PAD_LEFT + PLOT_PAD_RIGHT, PLOT_PAD_LEFT + totalDays * pxPerDay + PLOT_PAD_RIGHT);

  const xFor = (i) => (n === 1 ? plotWidth / 2 : PLOT_PAD_LEFT + daysBetween(points[0].date, points[i].date) * pxPerDay);
  const yFor = (value) => PLOT_TOP + PLOT_HEIGHT * (1 - (value - axis.bottom) / span);

  // 水平グリッド線(プロット側)とy軸の数値ラベル(y軸側)。浮動小数の蓄積誤差をround1で吸収。
  let grid = '';
  let yAxisLabels = '';
  for (let v = axis.bottom; v <= axis.top + 1e-9; v = round1(v + axis.step)) {
    const y = round2(yFor(v));
    const label = axis.step < 1 ? v.toFixed(1) : String(v);
    grid += `<line class="chart-grid" x1="0" y1="${y}" x2="${round2(plotWidth)}" y2="${y}" />`;
    yAxisLabels += `<text class="chart-axis-label" x="${Y_LABEL_X}" y="${round2(y + 3)}" text-anchor="end" fill="${AXIS_LABEL_COLOR}">${label}</text>`;
  }

  // 目標線(赤の点線)。スクロール領域全幅に引く。
  let targetLine = '';
  if (target != null) {
    const y = round2(yFor(target));
    targetLine = `<line x1="0" y1="${y}" x2="${round2(plotWidth)}" y2="${y}" style="stroke:#ef4444; stroke-width:1.5; stroke-dasharray:4 4;" />`;
  }

  const xy = points.map((p, i) => ({ x: round2(xFor(i)), y: round2(yFor(p.value)) }));

  // 間隔がGAP_SEGMENT_DAYS以上空いた点の間はセグメントを分割する
  const segments = [[0]];
  for (let i = 1; i < n; i++) {
    const gapDays = daysBetween(points[i - 1].date, points[i].date);
    if (gapDays < GAP_SEGMENT_DAYS) {
      segments[segments.length - 1].push(i);
    } else {
      segments.push([i]);
    }
  }

  // セグメント内(2点以上)はmonotone曲線の実線、セグメント間の空白は点線の直線で結ぶ
  let path = '';
  let gapLines = '';
  segments.forEach((seg, segIndex) => {
    if (seg.length >= 2) {
      const d = monotonePath(seg.map((i) => xy[i]));
      if (d) path += `<path d="${d}" style="stroke:${color}; stroke-width:2.5; fill:none; stroke-linejoin:round; stroke-linecap:round;" />`;
    }
    if (segIndex > 0) {
      const prevIndex = segments[segIndex - 1][segments[segIndex - 1].length - 1];
      const curIndex = seg[0];
      const p1 = xy[prevIndex];
      const p2 = xy[curIndex];
      gapLines += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="2" stroke-dasharray="6 6" opacity="0.6" />`;
    }
  });

  // 点が密集しているときはドットを縮小・省略して線を見やすくする
  const avgSpacing = n > 1 ? (xy[n - 1].x - xy[0].x) / (n - 1) : Infinity;
  const dotRadius = avgSpacing >= 8 ? 3 : avgSpacing >= 4 ? 2 : 0;
  const dots = dotRadius > 0
    ? xy.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${dotRadius}" style="fill:#fff; stroke:${color}; stroke-width:2.5;" />`).join('')
    : '';

  // x軸ラベルは貪欲法で間引く: 先頭は必ず描画し、以降は前回描画したラベルから45px以上離れた点のみ描画
  let xLabels = '';
  let lastLabelX = null;
  points.forEach((p, i) => {
    const x = xy[i].x;
    if (i === 0 || lastLabelX === null || x - lastLabelX >= X_LABEL_MIN_GAP) {
      xLabels += `<text class="chart-axis-label" x="${x}" y="${X_LABEL_Y}" text-anchor="middle" fill="${AXIS_LABEL_COLOR}">${toMonthDay(p.date)}</text>`;
      lastLabelX = x;
    }
  });

  const first = toMonthDay(points[0].date);
  const last = toMonthDay(points[n - 1].date);

  const yAxisSvg = `<svg class="chart-yaxis" width="${AXIS_WIDTH}" height="${H}" viewBox="0 0 ${AXIS_WIDTH} ${H}">
  ${yAxisLabels}
</svg>`;

  const lineChartSvg = `<svg class="line-chart" width="${round2(plotWidth)}" height="${H}" viewBox="0 0 ${round2(plotWidth)} ${H}" role="img" aria-label="${first}から${last}までの推移(${unit})">
  ${grid}
  ${targetLine}
  ${path}
  ${gapLines}
  ${dots}
  ${xLabels}
</svg>`;

  return `<div class="chart-area">${yAxisSvg}<div class="chart-scroll">${lineChartSvg}</div></div>`;
}
