const MAX_PASSKEY_NAME_LENGTH = 40;

export function normalizePasskeyName(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > MAX_PASSKEY_NAME_LENGTH) return null;
  return normalized;
}
