import { methodAllowed, sendJson } from '../_lib/http.js';
import { clearSessionCookie } from '../_lib/session.js';

export default function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;
  response.setHeader('Set-Cookie', clearSessionCookie());
  sendJson(response, 200, { ok: true });
}
