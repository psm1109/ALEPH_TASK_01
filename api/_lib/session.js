import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSql } from './db.js';

const COOKIE_NAME = '__Host-private_session';
const SESSION_SECONDS = 60 * 60 * 8;

export function isSessionConfigured() {
  return typeof process.env.SESSION_SECRET === 'string' && process.env.SESSION_SECRET.length >= 32;
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function hashSessionId(value) {
  return createHash('sha256').update(value).digest('hex');
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

function readSession(request) {
  const secret = process.env.SESSION_SECRET;
  const token = getCookies(request)[COOKIE_NAME];
  if (!secret || !token) return null;

  const tokenParts = token.split('.');
  if (tokenParts.length !== 2) return null;
  const [encodedPayload, signature] = tokenParts;
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload, secret))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    const expiresAtSeconds = Number(payload.exp);
    if (
      typeof payload.sub !== 'string'
      || !payload.sub
      || typeof payload.sid !== 'string'
      || payload.sid.length < 32
      || !Number.isFinite(expiresAtSeconds)
      || expiresAtSeconds <= Math.floor(Date.now() / 1000)
    ) return null;
    return {
      sessionIdHash: hashSessionId(payload.sid),
      accountId: payload.sub,
    };
  } catch {
    return null;
  }
}

export async function createSession(sql = null, accountId = 'owner') {
  const secret = process.env.SESSION_SECRET;
  if (!isSessionConfigured()) throw new Error('SESSION_SECRET must be at least 32 characters');
  const database = sql || getSql();

  const sessionId = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  const encodedPayload = Buffer.from(JSON.stringify({
    sub: accountId,
    sid: sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  })).toString('base64url');
  const token = `${encodedPayload}.${sign(encodedPayload, secret)}`;

  await database`DELETE FROM passkey_sessions WHERE expires_at <= now()`;
  await database`
    INSERT INTO passkey_sessions (session_id_hash, account_id, expires_at)
    VALUES (${hashSessionId(sessionId)}, ${accountId}, ${expiresAt})
  `;

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function getSessionAccountId(request, sql = null) {
  const session = readSession(request);
  if (!session) return null;

  const database = sql || getSql();
  const rows = await database`
    SELECT account_id
    FROM passkey_sessions
    WHERE session_id_hash = ${session.sessionIdHash}
      AND account_id = ${session.accountId}
      AND expires_at > now()
    LIMIT 1
  `;
  return rows[0]?.account_id || null;
}

export async function hasValidSession(request, sql = null) {
  return Boolean(await getSessionAccountId(request, sql));
}

export async function revokeSession(request, sql = null) {
  const session = readSession(request);
  if (!session) return false;

  const database = sql || getSql();
  const rows = await database`
    DELETE FROM passkey_sessions
    WHERE session_id_hash = ${session.sessionIdHash}
    RETURNING session_id_hash
  `;
  return rows.length > 0;
}

export function hasSetupAccess(request) {
  const expected = process.env.PASSKEY_SETUP_SECRET;
  const provided = request.headers['x-passkey-setup-secret'];
  if (!expected || expected.length < 32 || typeof provided !== 'string') return false;
  return safeEqual(createHmac('sha256', expected).update('setup').digest('hex'), createHmac('sha256', provided).update('setup').digest('hex'));
}
