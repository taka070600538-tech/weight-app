export function computeBmi(weightKg, heightCm) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

// 日本肥満学会の区分(簡略版)
const BMI_CATEGORIES = [
  { max: 18.5, label: '低体重', color: '#3b82f6' },
  { max: 25, label: '普通体重', color: '#059669' },
  { max: 30, label: '肥満(1度)', color: '#facc15' },
  { max: Infinity, label: '肥満(2度以上)', color: '#ef4444' },
];

export function bmiCategory(bmi) {
  return BMI_CATEGORIES.find((c) => bmi < c.max);
}
