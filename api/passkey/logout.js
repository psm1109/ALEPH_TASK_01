import { logServerError, methodAllowed, sendJson } from '../_lib/http.js';
import { clearSessionCookie, revokeSession } from '../_lib/session.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  response.setHeader('Set-Cookie', clearSessionCookie());
  try {
    await revokeSession(request);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    logServerError('passkey-logout', error);
    sendJson(response, 500, { error: '세션을 안전하게 종료하지 못했습니다.' });
  }
}
