import { createHash } from 'node:crypto';

function isProduction() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function getPasskeyConfig() {
  const rpID = process.env.PASSKEY_RP_ID || (isProduction() ? '' : 'localhost');
  const origin = process.env.PASSKEY_ORIGIN || (isProduction() ? '' : 'http://localhost:3000');

  if (!rpID || !origin) {
    throw new Error('PASSKEY_RP_ID and PASSKEY_ORIGIN are required in production');
  }

  return {
    rpID,
    origin,
    rpName: '나만 보는 자리',
    ownerName: process.env.PASSKEY_OWNER_NAME || 'owner',
    ownerUserID: new Uint8Array(
      createHash('sha256')
        .update(process.env.PASSKEY_USER_HANDLE || 'local-owner-only')
        .digest(),
    ),
  };
}
