# 体重・腹囲手帳 (weight-app)

体重(kg)と腹囲(cm)を記録するPWA。BMI自動計算・推移グラフ(目標線付き)・GitHub自動バックアップ対応。

- 公開URL: https://taka070600538-tech.github.io/weight-app/
- バックアップ先: 非公開リポジトリ `app-data` の `weight-app/backup.json`(app-sync共通基盤)

## 開発

- テスト: `npm test`
- ローカル確認: `node tools/serve.js` → http://localhost:8124
- sw.js の ASSETS と CACHE_NAME の更新を忘れない(pwaAssets.test.js が整合性を検証する)
