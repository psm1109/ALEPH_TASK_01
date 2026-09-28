import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { consumeChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { normalizePasskeyName } from '../_lib/passkey-name.js';
import { getRegistrationAccess } from '../_lib/registration-access.js';
import { createSession, getSessionAccountId, hasSetupAccess, isSessionConfigured } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  try {
    const sessionAccountId = await getSessionAccountId(request);
    const sessionAuthorized = Boolean(sessionAccountId);
    const setupAuthorized = hasSetupAccess(request);
    if (!isSessionConfigured()) {
      sendJson(response, 503, { error: '서버 세션 설정이 완료되지 않았습니다.' });
      return;
    }

    const { ceremonyId, credential, displayName } = readJsonBody(request);
    const passkeyName = normalizePasskeyName(displayName);
    if (!passkeyName) {
      sendJson(response, 400, { error: '패스키 이름을 1~40자로 입력해 주세요.' });
      return;
    }
    const sql = getSql();
    const existing = await sql`SELECT 1 FROM passkey_credentials LIMIT 1`;
    const challenge = await consumeChallenge(ceremonyId, 'registration');
    if (!challenge || !credential) {
      sendJson(response, 400, { error: '등록 요청이 만료되었거나 올바르지 않습니다.' });
      return;
    }
    const newAccount = Boolean(challenge.site_user_id && challenge.account_id !== 'owner' && challenge.account_id !== sessionAccountId);
    if (newAccount && existing.length === 0) {
      sendJson(response, 409, { error: '첫 패스키를 먼저 등록해 주세요.' });
      return;
    }
    const registrationAccess = getRegistrationAccess({
      sessionAuthorized,
      setupAuthorized,
      hasCredential: existing.length > 0,
    });
    if (!registrationAccess.allowed) {
      sendJson(response, registrationAccess.status, { error: registrationAccess.error });
      return;
    }

    if (challenge.source_account_id !== sessionAccountId || !challenge.account_id) {
      sendJson(response, 403, { error: '등록을 시작한 계정의 세션이 필요합니다.' });
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
    const creatingAccount = Boolean(challenge.site_user_id);
    const insertAccount = sql`
      INSERT INTO passkey_accounts (account_id, site_user_id)
      VALUES (${challenge.account_id}, ${challenge.site_user_id})
    `;
    const insertCredential = sql`
      INSERT INTO passkey_credentials (
        credential_id, display_name, public_key, counter, transports, device_type, backed_up,
        webauthn_user_id, account_id, bootstrap_registration
      ) VALUES (
        ${passkey.id}, ${passkeyName}, ${Buffer.from(passkey.publicKey)}, ${passkey.counter},
        ${JSON.stringify(passkey.transports || [])}::jsonb, ${credentialDeviceType},
        ${credentialBackedUp}, ${challenge.webauthn_user_id},
        ${challenge.account_id}, ${registrationAccess.bootstrap}
      )
    `;
    if (creatingAccount) {
      const statements = [insertAccount, insertCredential];
      if (!registrationAccess.bootstrap) {
        statements.push(sql`
          INSERT INTO passkey_private_items (account_id, category, title, body, sort_order)
          VALUES (${challenge.account_id}, '검증', '새 계정의 가상 기록',
            '계정 분리 확인을 위해 만든 자료입니다. 실제 개인정보가 아닙니다.', 1)
        `);
      }
      await sql.transaction(statements);
    } else {
      await insertCredential;
    }
    response.setHeader('Set-Cookie', await createSession(sql, challenge.account_id));
    sendJson(response, 200, { verified: true });
  } catch (error) {
    if (error?.code === '23505') {
      sendJson(response, 409, { error: '이미 사용 중인 사용자 ID이거나 패스키입니다.' });
      return;
    }
    logServerError('register-verify', error);
    sendJson(response, 400, { error: '패스키 등록을 확인하지 못했습니다.' });
  }
}
