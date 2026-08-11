import { buildLineChartSvg } from './chart.js';
import { formatDate, shiftDate } from './dateUtils.js';
import { loadRecords, filterFromDate } from './records.js';
import { loadProfile } from './profile.js';

const PERIODS = [
  { id: '1m', label: '1ヶ月', days: 30 },
  { id: '3m', label: '3ヶ月', days: 90 },
  { id: 'all', label: '全期間', days: null },
];

function chartSection(title, points, target, unit, color, daysPerScreen) {
  if (points.length === 0) {
    return `<section class="panel">
      <h2 class="panel-title">${title}</h2>
      <div class="empty-state"><p>この期間の記録がありません</p></div>
    </section>`;
  }
  return `<section class="panel">
    <h2 class="panel-title">${title}</h2>
    <div class="chart-scroll">${buildLineChartSvg(points, { target, unit, color, daysPerScreen })}</div>
    ${target != null ? `<p class="panel-note">赤の点線は目標(${target}${unit})</p>` : ''}
  </section>`;
}

export function renderGraphView(container) {
  const state = { period: 'all' };

  function render() {
    const today = formatDate(new Date());
    const period = PERIODS.find((p) => p.id === state.period);
    const all = loadRecords(localStorage);
    const records = period.days != null ? filterFromDate(all, shiftDate(today, -period.days)) : all;
    const profile = loadProfile(localStorage);
    const weightPoints = records.filter((r) => r.weight != null).map((r) => ({ date: r.date, value: r.weight }));
    const waistPoints = records.filter((r) => r.waist != null).map((r) => ({ date: r.date, value: r.waist }));
    const daysPerScreen = period.days ?? 365;

    const buttons = PERIODS.map((p) =>
      `<button type="button" class="seg-btn ${p.id === state.period ? 'is-active' : ''}" data-period="${p.id}">${p.label}</button>`
    ).join('');

    container.innerHTML = `
      <div class="seg-control">${buttons}</div>
      ${chartSection('体重の推移', weightPoints, profile.targetWeight, 'kg', '#059669', daysPerScreen)}
      ${chartSection('腹囲の推移', waistPoints, profile.targetWaist, 'cm', '#0ea5e9', daysPerScreen)}
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
