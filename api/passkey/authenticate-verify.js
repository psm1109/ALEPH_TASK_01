import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { consumeChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { createSession, isSessionConfigured } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  if (!isSessionConfigured()) {
    sendJson(response, 503, { error: '서버 세션 설정이 완료되지 않았습니다.' });
    return;
  }

  try {
    const { ceremonyId, credential } = readJsonBody(request);
    const challenge = await consumeChallenge(ceremonyId, 'authentication');
    if (!challenge || !credential?.id) {
      sendJson(response, 400, { error: '인증 요청이 만료되었거나 올바르지 않습니다.' });
      return;
    }

    const sql = getSql();
    const rows = await sql`
      SELECT credential_id, account_id, public_key, counter, transports
      FROM passkey_credentials
      WHERE credential_id = ${credential.id}
    `;
    const stored = rows[0];
    if (!stored) {
      sendJson(response, 401, { error: '등록되지 않은 패스키입니다.' });
      return;
    }

    const config = getPasskeyConfig();
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(stored.public_key),
        counter: Number(stored.counter),
        transports: stored.transports,
      },
    });
    if (!verification.verified) {
      sendJson(response, 401, { verified: false });
      return;
    }

    await sql`
      UPDATE passkey_credentials
      SET counter = ${verification.authenticationInfo.newCounter}, last_used_at = now()
      WHERE credential_id = ${stored.credential_id}
    `;
    response.setHeader('Set-Cookie', await createSession(sql, stored.account_id));
    sendJson(response, 200, { verified: true });
  } catch (error) {
    logServerError('authenticate-verify', error);
    sendJson(response, 401, { error: '패스키 인증에 실패했습니다.' });
  }
}
