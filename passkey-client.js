import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export const shouldStartPasskeyRegistration = (registrationAvailable) => registrationAvailable;

export const describePasskeyClientError = (error, isRegistration) => {
  if (error?.name === 'NotAllowedError') {
    return isRegistration
      ? '패스키 등록을 취소했거나 등록 창을 완료하지 않았습니다. 서버에는 패스키가 저장되지 않았습니다.'
      : '패스키 인증을 취소했거나 인증 창을 완료하지 않았습니다.';
  }
  return error?.message || '패스키 요청을 처리하지 못했습니다.';
};

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

export const runPasskeyCeremony = async (kind, { setupCode = '', displayName = '' } = {}) => {
  const isRegistration = kind === 'register';
  const prefix = isRegistration ? 'register' : 'authenticate';
  const headers = setupCode ? { 'X-Passkey-Setup-Secret': setupCode } : {};
  const { options, ceremonyId } = await requestJson(`/api/passkey/${prefix}-options`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  let credential;
  try {
    credential = isRegistration
      ? await startRegistration({ optionsJSON: options })
      : await startAuthentication({ optionsJSON: options });
  } catch (error) {
    await requestJson('/api/passkey/challenge-cancel', {
      method: 'POST',
      body: JSON.stringify({
        ceremonyId,
        ceremonyType: isRegistration ? 'registration' : 'authentication',
      }),
    }).catch(() => {});
    throw new Error(describePasskeyClientError(error, isRegistration));
  }
  await requestJson(`/api/passkey/${prefix}-verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ceremonyId, credential, ...(isRegistration ? { displayName } : {}) }),
  });
};
