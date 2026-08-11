export function buildBackupPayload(records, profile, now = new Date()) {
  return { version: 1, exportedAt: now.toISOString(), records, profile };
}

export function validateBackupData(data) {
  if (!data || data.version !== 1) throw new Error('バックアップデータの形式が不正です(version)');
  if (!Array.isArray(data.records)) throw new Error('バックアップデータの形式が不正です(records)');
  return data;
}
