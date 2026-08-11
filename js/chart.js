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
