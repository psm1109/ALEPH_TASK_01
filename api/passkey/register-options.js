import { generateRegistrationOptions } from '@simplewebauthn/server';
import { saveChallenge } from '../_lib/challenges.js';
import { getPasskeyConfig } from '../_lib/config.js';
import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, sendJson } from '../_lib/http.js';
import { getRegistrationAccess } from '../_lib/registration-access.js';
import { hasSetupAccess, hasValidSession } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  const sessionAuthorized = hasValidSession(request);
  const setupAuthorized = hasSetupAccess(request);
  const initialAccess = getRegistrationAccess({ sessionAuthorized, setupAuthorized, hasCredential: false });
  if (!initialAccess.allowed) {
    sendJson(response, initialAccess.status, { error: initialAccess.error });
    return;
  }

  try {
    const sql = getSql();
    const config = getPasskeyConfig();
    const credentials = await sql`
      SELECT credential_id, transports FROM passkey_credentials ORDER BY created_at ASC
    `;
    const registrationAccess = getRegistrationAccess({
      sessionAuthorized,
      setupAuthorized,
      hasCredential: credentials.length > 0,
    });
    if (!registrationAccess.allowed) {
      sendJson(response, registrationAccess.status, { error: registrationAccess.error });
      return;
    }

    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: config.ownerUserID,
      userName: config.ownerName,
      userDisplayName: config.ownerName,
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
    const ceremonyId = await saveChallenge('registration', options.challenge, config.ownerUserID);
    sendJson(response, 200, { options, ceremonyId });
  } catch (error) {
    logServerError('register-options', error);
    sendJson(response, 500, { error: '패스키 등록을 시작하지 못했습니다.' });
  }
}
