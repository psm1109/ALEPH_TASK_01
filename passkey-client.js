import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!payload) {
    const error = new Error('서버가 올바른 JSON 응답을 반환하지 않았습니다.');
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload.error || '요청을 처리하지 못했습니다.');
    error.status = response.status;
    throw error;
  }
  return payload;
};

export const runPasskeyCeremony = async (kind, setupCode = '') => {
  const isRegistration = kind === 'register';
  const prefix = isRegistration ? 'register' : 'authenticate';
  const headers = setupCode ? { 'X-Passkey-Setup-Secret': setupCode } : {};
  const { options, ceremonyId } = await requestJson(`/api/passkey/${prefix}-options`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const credential = isRegistration
    ? await startRegistration({ optionsJSON: options })
    : await startAuthentication({ optionsJSON: options });
  await requestJson(`/api/passkey/${prefix}-verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ceremonyId, credential }),
  });
};
