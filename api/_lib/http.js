export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(payload));
}

export function methodAllowed(request, response, method) {
  if (request.method === method) return true;
  response.setHeader('Allow', method);
  sendJson(response, 405, { error: '허용되지 않은 요청 방식입니다.' });
  return false;
}

export function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return {};
}

export function logServerError(label, error) {
  const safeMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[${label}] ${safeMessage}`);
}
