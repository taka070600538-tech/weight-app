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
    <section class="panel" id="backup-section"></section>
    <section class="panel" id="token-section"></section>
    <section class="panel">
      <h2 class="panel-title">インポート・エクスポート</h2>
      <p class="panel-note">アプリのデータをJSONファイルに書き出したり、ファイルから取り込んだりできます。</p>
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

  // 描画順を固定するため、renderSyncSettingsではなくrenderBackupControls/renderTokenSettingsを個別に呼ぶ
  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => {
      sync.renderBackupControls(container.querySelector('#backup-section'));
      sync.renderTokenSettings(container.querySelector('#token-section'));
    })
    .catch(() => {
      const message = '<p class="panel-note">GitHubバックアップ機能は現在利用できません(オフラインの可能性)。</p>';
      container.querySelector('#backup-section').innerHTML = message;
      container.querySelector('#token-section').innerHTML = message;
    });
}
