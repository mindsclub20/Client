export function text(value, { min = 1, max = 2000 } = {}) {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result.length < min || result.length > max ? null : result;
}
export function email(value) {
  const result = text(value, { min: 3, max: 254 });
  return result && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result.toLowerCase() : null;
}
export function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) return null;
  return Math.round(number * 100) / 100;
}
