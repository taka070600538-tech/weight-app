# 体重・腹囲手帳アプリ 設計書

作成日: 2026-08-11
参考: Google AI Studio製「体重・腹囲管理アプリ」(共用URL上のプレビュー)を再実装する。

## 目的

毎日の体重(kg)と腹囲(cm)をスマホから記録し、BMIの自動計算と推移グラフで健康管理を支援するPWA。
記録は app-sync 共通基盤で GitHub に1日1回自動バックアップし、PC側へ自動同期する。

## 配置とリポジトリ

- ローカル: `D:\Obsidian Vault for Claude Code\Git\体重腹囲アプリ`(Vault内Git慣習に従う独立リポジトリ)
- GitHub: `taka070600538-tech/weight-app`(Public)
- 公開URL: `https://taka070600538-tech.github.io/weight-app/`(Pages、main / (root) から配信)
- バックアップ先: 非公開リポジトリ `app-data` 内 `weight-app/backup.json`
  - PC側は既存タスク `AppDataGitPull` が app-data ごと pull するため追加設定不要
  - PAT設定済み端末(taka070600538-tech.github.io の localStorage 共有)なら追加設定なしで動作

## 画面構成(3タブ、血圧手帳アプリと同型)

### 1. 記録タブ
- 入力: 記録日(date、初期値=今日)・体重(kg, 数値, 小数1位)・腹囲(cm, 数値, 小数1位)・メモ(任意テキスト)
- BMI自動プレビュー: 体重入力中にリアルタイム表示。BMI = 体重kg ÷ (身長m)²、小数1位。
  身長未設定時は「設定タブで身長を入力してください」と案内表示
- 保存: 同じ日付の記録は上書き(1日1件、日付キー)
- 履歴一覧: 新しい順。日付・体重・腹囲・BMI・メモを表示。各行に削除ボタン(確認ダイアログあり)

### 2. グラフタブ
- 体重・腹囲それぞれの折れ線グラフ(自前SVG描画、血圧手帳の bpChart.js と同方式)
- 目標体重・目標腹囲が設定済みなら赤い目標線を表示
- 期間切替: 1ヶ月 / 3ヶ月 / 全期間
- データ0件時は案内メッセージ

### 3. 設定タブ
- プロフィール: 身長(cm)・目標体重(kg)・目標腹囲(cm)。初期値はすべて空欄(アプリ内で設定)
- app-sync: `renderSyncSettings(コンテナ)` でトークン設定・バックアップ操作を表示
- ファイルへのバックアップ: JSONエクスポート / インポート(日付キーで mergeRecords、インポート側優先)

## データ設計

- localStorage キーは `weight-app.` プレフィックスで名前空間分離
  (同一オリジンの全アプリで localStorage が共有されるため)
  - `weight-app.records`: `{ "YYYY-MM-DD": { weight, waist, memo } }` 形式(日付キーのオブジェクト)
  - `weight-app.profile`: `{ height, targetWeight, targetWaist }`
- app-sync の collect/restore は records と profile をまとめた1オブジェクトを扱う
- 復元(GitHubから復元)は全置き換え。PC→アプリ方向の反映時は push 前にマージ必須(血圧手帳と同運用)

## 技術構成

- `index.html` + `style.css` + `js/` 分割ESモジュール + `sw.js`(PWA)+ `manifest.json` + `icons/icon.svg`
- js モジュール分割(血圧手帳準拠): `app.js`(タブ制御・初期化)、`records.js`(記録CRUD)、
  `recordForm.js`(記録タブUI)、`historyList.js`(履歴一覧)、`bmi.js`(BMI計算)、
  `chart.js`(SVG折れ線グラフ)、`graphView.js`(グラフタブUI)、`settingsView.js`(設定タブUI)、
  `backup.js`(エクスポート/インポート)、`dateUtils.js`
- sw.js: ASSETS 列挙 + CACHE_NAME。app-sync の URL はキャッシュしない
- テスト: `npm test`(node:test、外部依存なし)
  - BMI計算、records の CRUD・マージ、グラフ座標計算、dateUtils、PWAアセット整合性(pwaAssets.test.js)
- ローカル確認: `node tools/serve.js`(port 8124。血圧手帳の8123と衝突回避)、launch.json 名 "weight-app"

## エラーハンドリング

- 体重・腹囲の未入力/非数値/0以下は保存時にバリデーションで弾く(どちらか片方のみの記録は許可)
- app-sync 読み込み失敗(オフライン)時はスキップし、アプリ本体は動作継続
- インポートJSONの形式不正時はエラーメッセージ表示、既存データは変更しない

## 実装の進め方

- 設計・計画・検証(テスト実行・動作確認・レビュー): セッション本体(Fable 5)
- 実装: sonnet サブエージェントに委譲(グローバル指示のモデル使い分けに従う)
