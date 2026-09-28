import { describePasskeyLocation } from '../_lib/passkey-metadata.js';
import { getSql } from '../_lib/db.js';
import { logServerError, readJsonBody, sendJson } from '../_lib/http.js';
import { hasValidSession } from '../_lib/session.js';

function methodAllowed(request, response) {
  if (request.method === 'GET' || request.method === 'DELETE') return true;
  response.setHeader('Allow', 'GET, DELETE');
  sendJson(response, 405, { error: '허용되지 않은 요청 방식입니다.' });
  return false;
}

export default async function handler(request, response) {
  if (!methodAllowed(request, response)) return;
  if (!hasValidSession(request)) {
    sendJson(response, 401, { error: '패스키 인증이 필요합니다.' });
    return;
  }

  try {
    const sql = getSql();

    if (request.method === 'GET') {
      const credentials = await sql`
        SELECT credential_id, transports, device_type, backed_up,
               bootstrap_registration, created_at, last_used_at
        FROM passkey_credentials
        ORDER BY created_at ASC
      `;
      sendJson(response, 200, {
        passkeys: credentials.map((credential, index) => ({
          id: credential.credential_id,
          name: `패스키 ${index + 1}`,
          location: describePasskeyLocation({
            transports: credential.transports,
            deviceType: credential.device_type,
            backedUp: credential.backed_up,
          }),
          backedUp: credential.backed_up,
          bootstrap: credential.bootstrap_registration,
          createdAt: credential.created_at,
          lastUsedAt: credential.last_used_at,
        })),
      });
      return;
    }

    const { credentialId } = readJsonBody(request);
    if (typeof credentialId !== 'string' || !credentialId) {
      sendJson(response, 400, { error: '삭제할 패스키를 선택해 주세요.' });
      return;
    }

    const [credentials, deleted] = await sql.transaction((transaction) => [
      transaction`SELECT credential_id FROM passkey_credentials FOR UPDATE`,
      transaction`
        DELETE FROM passkey_credentials
        WHERE credential_id = ${credentialId}
          AND (SELECT count(*) FROM passkey_credentials) > 1
        RETURNING credential_id
      `,
    ]);
    if (deleted.length > 0) {
      sendJson(response, 200, { deleted: true });
      return;
    }
    if (!credentials.some((credential) => credential.credential_id === credentialId)) {
      sendJson(response, 404, { error: '패스키를 찾을 수 없습니다.' });
      return;
    }
    sendJson(response, 409, { error: '마지막 패스키는 삭제할 수 없습니다.' });
  } catch (error) {
    logServerError('passkey-credentials', error);
    sendJson(response, 500, { error: '패스키 목록을 처리하지 못했습니다.' });
  }
}
