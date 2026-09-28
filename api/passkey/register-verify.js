import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { consumeChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { normalizePasskeyName } from '../_lib/passkey-name.js';
import { getRegistrationAccess } from '../_lib/registration-access.js';
import { createSession, hasSetupAccess, hasValidSession, isSessionConfigured } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  try {
    const sessionAuthorized = await hasValidSession(request);
    const setupAuthorized = hasSetupAccess(request);
    const initialAccess = getRegistrationAccess({ sessionAuthorized, setupAuthorized, hasCredential: false });
    if (!initialAccess.allowed) {
      sendJson(response, initialAccess.status, { error: initialAccess.error });
      return;
    }
    if (!isSessionConfigured()) {
      sendJson(response, 503, { error: '서버 세션 설정이 완료되지 않았습니다.' });
      return;
    }

    const sql = getSql();
    const existing = await sql`SELECT 1 FROM passkey_credentials LIMIT 1`;
    const registrationAccess = getRegistrationAccess({
      sessionAuthorized,
      setupAuthorized,
      hasCredential: existing.length > 0,
    });
    if (!registrationAccess.allowed) {
      sendJson(response, registrationAccess.status, { error: registrationAccess.error });
      return;
    }

    const { ceremonyId, credential, displayName } = readJsonBody(request);
    const passkeyName = normalizePasskeyName(displayName);
    if (!passkeyName) {
      sendJson(response, 400, { error: '패스키 이름을 1~40자로 입력해 주세요.' });
      return;
    }
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
    await sql`
      INSERT INTO passkey_credentials (
        credential_id, display_name, public_key, counter, transports, device_type, backed_up,
        webauthn_user_id, bootstrap_registration
      ) VALUES (
        ${passkey.id}, ${passkeyName}, ${Buffer.from(passkey.publicKey)}, ${passkey.counter},
        ${JSON.stringify(passkey.transports || [])}::jsonb, ${credentialDeviceType},
        ${credentialBackedUp}, ${challenge.webauthn_user_id}, ${registrationAccess.bootstrap}
      )
    `;
    response.setHeader('Set-Cookie', await createSession(sql));
    sendJson(response, 200, { verified: true });
  } catch (error) {
    logServerError('register-verify', error);
    sendJson(response, 400, { error: '패스키 등록을 확인하지 못했습니다.' });
  }
}
