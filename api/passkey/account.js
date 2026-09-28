import { getSql } from '../_lib/db.js';
import { logServerError, readJsonBody, sendJson } from '../_lib/http.js';
import { getSessionAccountId } from '../_lib/session.js';
import { normalizeSiteUserId } from '../_lib/site-user-id.js';

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    response.setHeader('Allow', 'GET, PATCH');
    sendJson(response, 405, { error: '허용되지 않은 요청 방식입니다.' });
    return;
  }
  try {
    const accountId = await getSessionAccountId(request);
    if (!accountId) {
      sendJson(response, 401, { error: '패스키 인증이 필요합니다.' });
      return;
    }
    const sql = getSql();
    if (request.method === 'GET') {
      const rows = await sql`SELECT site_user_id FROM passkey_accounts WHERE account_id = ${accountId}`;
      sendJson(response, 200, { siteUserId: rows[0]?.site_user_id || null });
      return;
    }
    const siteUserId = normalizeSiteUserId(readJsonBody(request).siteUserId);
    if (!siteUserId) {
      sendJson(response, 400, { error: '사용자 ID는 영문자로 시작하는 3~32자의 영문·숫자·_-로 입력해 주세요.' });
      return;
    }
    const updated = await sql`
      UPDATE passkey_accounts SET site_user_id = ${siteUserId}
      WHERE account_id = ${accountId} RETURNING site_user_id
    `;
    if (!updated.length) {
      sendJson(response, 404, { error: '계정을 찾을 수 없습니다.' });
      return;
    }
    sendJson(response, 200, { siteUserId: updated[0].site_user_id });
  } catch (error) {
    if (error?.code === '23505') {
      sendJson(response, 409, { error: '이미 사용 중인 사용자 ID입니다.' });
      return;
    }
    logServerError('passkey-account', error);
    sendJson(response, 500, { error: '사용자 ID를 처리하지 못했습니다.' });
  }
}
