export function normalizeSiteUserId(value) {
  if (typeof value !== 'string') return null;
  const userId = value.trim();
  return /^[A-Za-z][A-Za-z0-9_-]{2,31}$/.test(userId) ? userId : null;
}
