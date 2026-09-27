import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { consumeChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { createSessionCookie, hasSetupAccess, hasValidSession } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  if (!hasValidSession(request) && !hasSetupAccess(request)) {
    sendJson(response, 403, { error: '패스키 등록 권한이 없습니다.' });
    return;
  }

  try {
    const { ceremonyId, credential } = readJsonBody(request);
    const challenge = await consumeChallenge(ceremonyId, 'registration');
    if (!challenge || !credential) {
      sendJson(response, 400, { error: '등록 요청이 만료되었거나 올바르지 않습니다.' });
      return;
    }

    const config = getPasskeyConfig();
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      sendJson(response, 400, { verified: false });
      return;
    }

    const { credential: passkey, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const sql = getSql();
    await sql`
      INSERT INTO passkey_credentials (
        credential_id, public_key, counter, transports, device_type, backed_up, webauthn_user_id
      ) VALUES (
        ${passkey.id}, ${Buffer.from(passkey.publicKey)}, ${passkey.counter},
        ${JSON.stringify(passkey.transports || [])}::jsonb, ${credentialDeviceType},
        ${credentialBackedUp}, ${challenge.webauthn_user_id}
      )
      ON CONFLICT (credential_id) DO NOTHING
    `;
    response.setHeader('Set-Cookie', createSessionCookie());
    sendJson(response, 200, { verified: true });
  } catch (error) {
    logServerError('register-verify', error);
    sendJson(response, 400, { error: '패스키 등록을 확인하지 못했습니다.' });
  }
}
