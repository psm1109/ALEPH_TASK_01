import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = '__Host-private_session';
const SESSION_SECONDS = 60 * 60 * 8;

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, ...value]) => [key, value.join('=')]),
  );
}

export function createSessionCookie() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');

  const encodedPayload = Buffer.from(JSON.stringify({
    sub: 'owner',
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString('base64url');
  const token = `${encodedPayload}.${sign(encodedPayload, secret)}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function hasValidSession(request) {
  const secret = process.env.SESSION_SECRET;
  const token = getCookies(request)[COOKIE_NAME];
  if (!secret || !token) return false;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload, secret))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return payload.sub === 'owner' && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function hasSetupAccess(request) {
  const expected = process.env.PASSKEY_SETUP_SECRET;
  const provided = request.headers['x-passkey-setup-secret'];
  if (!expected || expected.length < 32 || typeof provided !== 'string') return false;
  return safeEqual(createHmac('sha256', expected).update('setup').digest('hex'), createHmac('sha256', provided).update('setup').digest('hex'));
}
