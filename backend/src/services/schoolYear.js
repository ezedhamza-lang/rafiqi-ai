export const STUDENT_SUBSCRIPTION_PRICE = 147;
export const TEACHER_SUBSCRIPTION_PRICE = 50;

export function currentSchoolYear(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function schoolYearBounds(schoolYear) {
  const [startYear, endYear] = String(schoolYear).split('-').map((n) => parseInt(n, 10));
  const start = new Date(startYear, 8, 1);
  const end = new Date(endYear, 5, 30, 23, 59, 59);
  return { start, end };
}

export function nextSchoolYear(schoolYear) {
  const [startYear, endYear] = String(schoolYear).split('-').map((n) => parseInt(n, 10));
  return `${startYear + 1}-${endYear + 1}`;
}

export function priceForType(type) {
  return type === 'TEACHER' ? TEACHER_SUBSCRIPTION_PRICE : STUDENT_SUBSCRIPTION_PRICE;
}
