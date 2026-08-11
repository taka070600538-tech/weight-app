export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftDate(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

// dateStrAからdateStrBまでの日数差。DST等で端数がずれる可能性があるためroundで安全に丸める。
export function daysBetween(dateStrA, dateStrB) {
  const diff = parseDate(dateStrB) - parseDate(dateStrA);
  return Math.round(diff / 86400000);
}
