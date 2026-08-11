// 記録の保存形式: { date: 'YYYY-MM-DD', weight, waist, memo, createdAt }
// 1日1件(dateがキー)。weight/waistは片方のみでも可。storageはlocalStorage互換(テストではフェイクを注入)。
const KEY = 'weight-app:records';

export function upsertRecord(records, record) {
  const rest = records.filter((r) => r.date !== record.date);
  return [...rest, record].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function loadRecords(storage) {
  try {
    const raw = storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(storage, records) {
  storage.setItem(KEY, JSON.stringify(records));
}

export function mergeRecords(existing, imported) {
  return imported.reduce((acc, record) => upsertRecord(acc, record), existing);
}

export function deleteRecord(records, date) {
  return records.filter((r) => r.date !== date);
}

export function filterFromDate(records, fromDate) {
  return records.filter((r) => r.date >= fromDate);
}
