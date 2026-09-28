import { randomBytes, randomUUID } from 'node:crypto';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { saveChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { getRegistrationAccess } from '../_lib/registration-access.js';
import { getSessionAccountId, hasSetupAccess, isSessionConfigured } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  try {
    const sessionAccountId = await getSessionAccountId(request);
    const sessionAuthorized = Boolean(sessionAccountId);
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
    const config = getPasskeyConfig();
    const newAccount = readJsonBody(request).newAccount === true;
    const accountId = newAccount && sessionAuthorized ? randomUUID() : sessionAccountId || 'owner';
    const credentials = newAccount ? [] : await sql`
      SELECT credential_id, transports, webauthn_user_id
      FROM passkey_credentials WHERE account_id = ${accountId} ORDER BY created_at ASC
    `;
    const anyCredential = await sql`SELECT 1 FROM passkey_credentials LIMIT 1`;
    const registrationAccess = getRegistrationAccess({
      sessionAuthorized,
      setupAuthorized,
      hasCredential: anyCredential.length > 0,
    });
    if (!registrationAccess.allowed) {
      sendJson(response, registrationAccess.status, { error: registrationAccess.error });
      return;
    }

    const userID = newAccount ? randomBytes(32) : credentials[0]?.webauthn_user_id || config.ownerUserID;
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID,
      userName: newAccount ? `test-${accountId}` : config.ownerName,
      userDisplayName: newAccount ? '검증 계정' : config.ownerName,
      attestationType: 'none',
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: credential.transports,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });
    const ceremonyId = await saveChallenge('registration', options.challenge, userID, accountId, sessionAccountId);
    sendJson(response, 200, { options, ceremonyId });
  } catch (error) {
    logServerError('register-options', error);
    sendJson(response, 500, { error: '패스키 등록을 시작하지 못했습니다.' });
  }
}
