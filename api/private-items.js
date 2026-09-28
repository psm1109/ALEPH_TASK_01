import { getSql } from './_lib/db.js';
import { logServerError, methodAllowed, sendJson } from './_lib/http.js';
import { getSessionAccountId } from './_lib/session.js';

export async function readPrivateItems(sql, accountId, itemId = null) {
  if (itemId !== null) {
    return sql`
      SELECT id, category, title, body, updated_at
      FROM passkey_private_items
      WHERE account_id = ${accountId} AND id = ${itemId}
    `;
  }
  return sql`
    SELECT id, category, title, body, updated_at
    FROM passkey_private_items
    WHERE account_id = ${accountId}
    ORDER BY sort_order ASC, id ASC
  `;
}

export function createPrivateItemsHandler({ resolveAccount = getSessionAccountId, getDatabase = getSql } = {}) {
  return async function handler(request, response) {
    if (!methodAllowed(request, response, 'GET')) return;
    try {
      const accountId = await resolveAccount(request);
      if (!accountId) {
        sendJson(response, 401, { error: '패스키 인증이 필요합니다.' });
        return;
      }
      const sql = getDatabase();
      const itemId = request.query?.itemId;
      if (itemId !== undefined) {
        if (typeof itemId !== 'string' || !/^[1-9]\d*$/.test(itemId)) {
          sendJson(response, 400, { error: '자료 번호가 올바르지 않습니다.' });
          return;
        }
        const matching = await readPrivateItems(sql, accountId, itemId);
        if (matching.length === 0) {
          sendJson(response, 404, { error: '자료를 찾을 수 없습니다.' });
          return;
        }
        sendJson(response, 200, { items: matching });
        return;
      }
      const items = await readPrivateItems(sql, accountId);
      sendJson(response, 200, { items });
    } catch (error) {
      logServerError('private-items', error);
      sendJson(response, 500, { error: '비공개 자료를 불러오지 못했습니다.' });
    }
  };
}

export default createPrivateItemsHandler();
