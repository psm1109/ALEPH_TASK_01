import { getSql } from '../_lib/db.js';
import { logServerError, methodAllowed, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'GET')) return;

  try {
    const sql = getSql();
    const credentials = await sql`SELECT 1 FROM passkey_credentials LIMIT 1`;
    sendJson(response, 200, { registrationAvailable: credentials.length === 0 });
  } catch (error) {
    logServerError('passkey-status', error);
    sendJson(response, 500, { error: '패스키 설정 상태를 확인하지 못했습니다.' });
  }
}
