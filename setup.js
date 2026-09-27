import { browserSupportsPasskeys } from '@simplewebauthn/browser';
import { requestJson, runPasskeyCeremony } from './passkey-client.js';

const setupForm = document.querySelector('[data-setup-form]');
const setupComplete = document.querySelector('[data-setup-complete]');
const setupCodeInput = document.querySelector('[data-setup-code]');
const setupRegisterButton = document.querySelector('[data-setup-register]');
const setupMessage = document.querySelector('[data-setup-message]');

const setSetupMessage = (message, isError = false) => {
  setupMessage.textContent = message;
  setupMessage.classList.toggle('is-error', isError);
};

const showSetupComplete = () => {
  setupForm.hidden = true;
  setupComplete.hidden = false;
};

const loadSetupStatus = async () => {
  try {
    const { registrationAvailable } = await requestJson('/api/passkey/status', { method: 'GET' });
    if (!registrationAvailable) showSetupComplete();
  } catch (error) {
    setupRegisterButton.disabled = true;
    setSetupMessage(error.message, true);
  }
};

setupRegisterButton.addEventListener('click', async () => {
  const setupCode = setupCodeInput.value;
  if (!setupCode) {
    setSetupMessage('일회용 설정 코드를 입력해 주세요.', true);
    setupCodeInput.focus();
    return;
  }

  setupRegisterButton.disabled = true;
  setSetupMessage('기기에서 패스키 저장 위치를 선택해 주세요.');
  try {
    await runPasskeyCeremony('register', setupCode);
    setupCodeInput.value = '';
    showSetupComplete();
    setSetupMessage('패스키 등록을 완료했습니다.');
  } catch (error) {
    setSetupMessage(error.message, true);
  } finally {
    setupRegisterButton.disabled = false;
  }
});

if (await browserSupportsPasskeys()) {
  loadSetupStatus();
} else {
  setupRegisterButton.disabled = true;
  setSetupMessage('이 브라우저에서는 패스키를 사용할 수 없습니다.', true);
}
