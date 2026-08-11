import { buildChartHtml } from './chart.js';
import { loadRecords } from './records.js';
import { loadProfile } from './profile.js';

const DAYS_PER_SCREEN = 365;

function chartSection(title, points, target, unit, color, daysPerScreen, chartHeight) {
  if (points.length === 0) {
    return `<section class="panel">
      <h2 class="panel-title">${title}</h2>
      <div class="empty-state"><p>この期間の記録がありません</p></div>
    </section>`;
  }
  return `<section class="panel">
    <h2 class="panel-title">${title}</h2>
    ${buildChartHtml(points, { target, unit, color, daysPerScreen, chartHeight })}
    ${target != null ? `<p class="panel-note">赤の点線は目標(${target}${unit})</p>` : ''}
  </section>`;
}

export function renderGraphView(container) {
  function render() {
    const records = loadRecords(localStorage);
    const profile = loadProfile(localStorage);
    const weightPoints = records.filter((r) => r.weight != null).map((r) => ({ date: r.date, value: r.weight }));
    const waistPoints = records.filter((r) => r.waist != null).map((r) => ({ date: r.date, value: r.waist }));

    // 画面内にヘッダー・タイトル・注記・下部ナビと2枚のグラフが収まるよう、
    // 画面高さから固定UI分(400px相当)を差し引いた残りを2枚のグラフで等分する。
    const chartHeight = Math.max(140, Math.min(280, Math.floor((window.innerHeight - 400) / 2)));

    container.innerHTML = `
      ${chartSection('体重の推移', weightPoints, profile.targetWeight, 'kg', '#059669', DAYS_PER_SCREEN, chartHeight)}
      ${chartSection('腹囲の推移', waistPoints, profile.targetWaist, 'cm', '#0ea5e9', DAYS_PER_SCREEN, chartHeight)}
    `;

    // 横スクロールを最新日付側(右端)に合わせる
    container.querySelectorAll('.chart-scroll').forEach((el) => {
      el.scrollLeft = el.scrollWidth;
    });
  }

  render();
}
