const KEY = 'weight-app:profile';
const EMPTY = { height: null, targetWeight: null, targetWaist: null };

export function loadProfile(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProfile(storage, profile) {
  storage.setItem(KEY, JSON.stringify({ ...EMPTY, ...profile }));
}
