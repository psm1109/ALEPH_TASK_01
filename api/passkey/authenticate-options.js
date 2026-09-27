import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { saveChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, sendJson } from '../_lib/http.js';
import { isSessionConfigured } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  if (!isSessionConfigured()) {
    sendJson(response, 503, { error: '서버 세션 설정이 완료되지 않았습니다.' });
    return;
  }

  try {
    const sql = getSql();
    const config = getPasskeyConfig();
    const credentials = await sql`
      SELECT credential_id, transports FROM passkey_credentials ORDER BY created_at ASC
    `;
    if (credentials.length === 0) {
      sendJson(response, 409, { error: '등록된 패스키가 없습니다.' });
      return;
    }

    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: 'required',
      allowCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: credential.transports,
      })),
    });
    const ceremonyId = await saveChallenge('authentication', options.challenge);
    sendJson(response, 200, { options, ceremonyId });
  } catch (error) {
    logServerError('authenticate-options', error);
    sendJson(response, 500, { error: '패스키 인증을 시작하지 못했습니다.' });
  }
}
