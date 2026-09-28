import { randomBytes, randomUUID } from 'node:crypto';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { saveChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';
import { getRegistrationAccess } from '../_lib/registration-access.js';
import { normalizeSiteUserId } from '../_lib/site-user-id.js';
import { getSessionAccountId, hasSetupAccess, isSessionConfigured } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  try {
    const { newAccount: requestedNewAccount, siteUserId: requestedSiteUserId } = readJsonBody(request);
    const newAccount = requestedNewAccount === true;
    const sessionAccountId = await getSessionAccountId(request);
    const sessionAuthorized = Boolean(sessionAccountId);
    const setupAuthorized = hasSetupAccess(request);
    const initialAccess = getRegistrationAccess({ sessionAuthorized, setupAuthorized, hasCredential: false });
    if (!newAccount && !initialAccess.allowed) {
      sendJson(response, initialAccess.status, { error: initialAccess.error });
      return;
    }
    if (!isSessionConfigured()) {
      sendJson(response, 503, { error: '서버 세션 설정이 완료되지 않았습니다.' });
      return;
    }

    const sql = getSql();
    const config = getPasskeyConfig();
    const accountId = newAccount ? randomUUID() : sessionAccountId || 'owner';
    const credentials = newAccount ? [] : await sql`
      SELECT credential_id, transports, webauthn_user_id
      FROM passkey_credentials WHERE account_id = ${accountId} ORDER BY created_at ASC
    `;
    const anyCredential = await sql`SELECT 1 FROM passkey_credentials LIMIT 1`;
    const registrationAccess = getRegistrationAccess({
      sessionAuthorized,
      setupAuthorized,
      hasCredential: anyCredential.length > 0,
      newAccount,
    });
    if (!registrationAccess.allowed) {
      sendJson(response, registrationAccess.status, { error: registrationAccess.error });
      return;
    }

    const creatingAccount = newAccount || registrationAccess.bootstrap;
    const siteUserId = creatingAccount ? normalizeSiteUserId(requestedSiteUserId) : null;
    if (creatingAccount && !siteUserId) {
      sendJson(response, 400, { error: '사용자 ID는 영문자로 시작하는 3~32자의 영문·숫자·_-로 입력해 주세요.' });
      return;
    }
    if (creatingAccount) {
      const taken = await sql`SELECT 1 FROM passkey_accounts WHERE lower(site_user_id) = lower(${siteUserId}) LIMIT 1`;
      if (taken.length) {
        sendJson(response, 409, { error: '이미 사용 중인 사용자 ID입니다.' });
        return;
      }
    }

    const existingAccount = !creatingAccount
      ? await sql`SELECT site_user_id FROM passkey_accounts WHERE account_id = ${accountId}`
      : [];
    const passkeyUserName = siteUserId || existingAccount[0]?.site_user_id || config.ownerName;

    const userID = newAccount ? randomBytes(32) : credentials[0]?.webauthn_user_id || config.ownerUserID;
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID,
      userName: passkeyUserName,
      userDisplayName: passkeyUserName,
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
    const ceremonyId = await saveChallenge('registration', options.challenge, userID, accountId, sessionAccountId, siteUserId);
    sendJson(response, 200, { options, ceremonyId });
  } catch (error) {
    logServerError('register-options', error);
    sendJson(response, 500, { error: '패스키 등록을 시작하지 못했습니다.' });
  }
}
