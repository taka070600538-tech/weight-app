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
