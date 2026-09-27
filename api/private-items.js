import { getSql } from './_lib/db.js';
import { logServerError, methodAllowed, sendJson } from './_lib/http.js';
import { hasValidSession } from './_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'GET')) return;
  if (!hasValidSession(request)) {
    sendJson(response, 401, { error: '패스키 인증이 필요합니다.' });
    return;
  }

  try {
    const sql = getSql();
    const items = await sql`
      SELECT id, category, title, body, updated_at
      FROM private_items
      ORDER BY sort_order ASC, id ASC
    `;
    sendJson(response, 200, { items });
  } catch (error) {
    logServerError('private-items', error);
    sendJson(response, 500, { error: '비공개 자료를 불러오지 못했습니다.' });
  }
}
