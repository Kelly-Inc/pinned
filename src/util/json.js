/** JSON.parse that never throws. Non-strings are returned as-is. */
export function parseJson(value, fallback = null) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

/** Accept a JSON-encoded array, a real array, or a comma list. */
export function parseList(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) return parsed;
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}
