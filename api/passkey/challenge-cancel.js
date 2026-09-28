import { discardChallenge } from '../_lib/challenges.js';
import { logServerError, methodAllowed, readJsonBody, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
  if (!methodAllowed(request, response, 'POST')) return;

  try {
    const { ceremonyId, ceremonyType } = readJsonBody(request);
    if (!['registration', 'authentication'].includes(ceremonyType)) {
      sendJson(response, 400, { error: '폐기할 패스키 요청 종류가 올바르지 않습니다.' });
      return;
    }
    const discarded = await discardChallenge(ceremonyId, ceremonyType);
    sendJson(response, 200, { discarded });
  } catch (error) {
    logServerError('challenge-cancel', error);
    sendJson(response, 500, { error: '패스키 요청을 정리하지 못했습니다.' });
  }
}
