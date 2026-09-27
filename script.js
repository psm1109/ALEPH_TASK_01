import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { requestJson, runPasskeyCeremony, shouldStartPasskeyRegistration } from './passkey-client.js';

const closeAllDetails = document.querySelector('.close-all-details');
const understandingItems = document.querySelectorAll('#work-style .understanding-item');

closeAllDetails.addEventListener('click', () => {
  understandingItems.forEach((item) => {
    item.open = false;
  });
});

const introRotator = document.querySelector('.intro-rotator');
const motionToggle = document.querySelector('.intro-motion-toggle');
const motionSymbol = motionToggle.querySelector('.motion-symbol');

motionToggle.addEventListener('click', () => {
  const isPaused = introRotator.classList.toggle('is-paused');
  motionToggle.setAttribute('aria-pressed', String(isPaused));
  const accessibleLabel = isPaused ? '애니메이션 재생' : '애니메이션 멈춤';
  motionToggle.setAttribute('aria-label', accessibleLabel);
  motionToggle.setAttribute('title', accessibleLabel);
  motionSymbol.textContent = isPaused ? '▶' : 'Ⅱ';
});

const galleryTrigger = document.querySelector('.learning-gallery-trigger');
const galleryModal = document.querySelector('#learning-gallery');
const galleryImage = document.querySelector('#gallery-image');
const galleryCaption = document.querySelector('#gallery-caption');
const galleryCloseButtons = document.querySelectorAll('[data-gallery-close]');
const previousButton = document.querySelector('[data-gallery-prev]');
const nextButton = document.querySelector('[data-gallery-next]');
const galleryImageModules = import.meta.glob('./images/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const galleryImages = Object.entries(galleryImageModules)
  .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
  .map(([, url]) => url);
let activeImageIndex = 0;
let lastFocusedElement;

const showGalleryImage = (index) => {
  activeImageIndex = (index + galleryImages.length) % galleryImages.length;
  const imageNumber = activeImageIndex + 1;
  galleryImage.src = galleryImages[activeImageIndex];
  galleryImage.alt = `학습 기록 ${imageNumber}`;
  galleryCaption.innerHTML = `<strong>${String(imageNumber).padStart(2, '0')}</strong> / ${String(galleryImages.length).padStart(2, '0')}`;
};

const closeGallery = () => {
  galleryModal.hidden = true;
  document.querySelector('main').inert = false;
  document.querySelector('footer').inert = false;
  document.body.style.overflow = '';
  lastFocusedElement?.focus();
};

galleryTrigger.addEventListener('click', (event) => {
  event.preventDefault();
  lastFocusedElement = document.activeElement;
  showGalleryImage(0);
  galleryModal.hidden = false;
  document.querySelector('main').inert = true;
  document.querySelector('footer').inert = true;
  document.body.style.overflow = 'hidden';
  galleryModal.querySelector('.gallery-close').focus();
});

galleryCloseButtons.forEach((button) => button.addEventListener('click', closeGallery));
previousButton.addEventListener('click', () => showGalleryImage(activeImageIndex - 1));
nextButton.addEventListener('click', () => showGalleryImage(activeImageIndex + 1));

document.addEventListener('keydown', (event) => {
  if (galleryModal.hidden) return;
  if (event.key === 'Tab') {
    const buttons = [...galleryModal.querySelectorAll('button')];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  if (event.key === 'Escape') closeGallery();
  if (event.key === 'ArrowLeft') showGalleryImage(activeImageIndex - 1);
  if (event.key === 'ArrowRight') showGalleryImage(activeImageIndex + 1);
});

const privatePanel = document.querySelector('[data-private-panel]');
const privateLock = document.querySelector('[data-private-lock]');
const privateContent = document.querySelector('[data-private-content]');
const privateItems = document.querySelector('[data-private-items]');
const privateMessage = document.querySelector('[data-private-message]');
const loginButton = document.querySelector('[data-passkey-login]');
const logoutButton = document.querySelector('[data-passkey-logout]');
const addPasskeyButton = document.querySelector('[data-passkey-add]');
const bootstrapDialog = document.querySelector('[data-passkey-bootstrap-dialog]');
const bootstrapForm = document.querySelector('[data-passkey-bootstrap-form]');
const bootstrapCodeInput = document.querySelector('[data-passkey-bootstrap-code]');
const bootstrapSubmitButton = document.querySelector('[data-passkey-bootstrap-submit]');
const bootstrapMessage = document.querySelector('[data-passkey-bootstrap-message]');
const bootstrapCancelButtons = document.querySelectorAll('[data-passkey-bootstrap-cancel]');

const setPrivateMessage = (message, isError = false) => {
  privateMessage.textContent = message;
  privateMessage.classList.toggle('is-error', isError);
};

const renderPrivateItems = (items) => {
  privateItems.replaceChildren();
  items.forEach((item) => {
    const article = document.createElement('article');
    const category = document.createElement('p');
    const title = document.createElement('h3');
    const body = document.createElement('p');
    article.className = 'private-item';
    category.className = 'private-item-category';
    category.textContent = item.category;
    title.textContent = item.title;
    body.textContent = item.body;
    article.append(category, title, body);
    privateItems.append(article);
  });
};

const lockPrivateSpace = () => {
  privatePanel.dataset.state = 'locked';
  privateContent.hidden = true;
  privateLock.hidden = false;
  privateItems.replaceChildren();
};

const loadPrivateItems = async ({ quiet = false } = {}) => {
  try {
    const { items } = await requestJson('/api/private-items', { method: 'GET' });
    renderPrivateItems(items);
    privateLock.hidden = true;
    privateContent.hidden = false;
    privatePanel.dataset.state = 'open';
    if (!quiet) setPrivateMessage('비공개 기록을 안전하게 불러왔습니다.');
    return true;
  } catch (error) {
    lockPrivateSpace();
    if (!quiet && error.status !== 401) setPrivateMessage(error.message, true);
    return false;
  }
};

const setBootstrapMessage = (message, isError = false) => {
  bootstrapMessage.textContent = message;
  bootstrapMessage.classList.toggle('is-error', isError);
};

const openBootstrapDialog = () => {
  setBootstrapMessage('');
  bootstrapDialog.showModal();
  bootstrapCodeInput.focus();
};

bootstrapCancelButtons.forEach((button) => button.addEventListener('click', () => {
  bootstrapCodeInput.value = '';
  bootstrapDialog.close();
}));

bootstrapDialog.addEventListener('close', () => {
  bootstrapCodeInput.value = '';
  bootstrapSubmitButton.disabled = false;
});

bootstrapForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const setupCode = bootstrapCodeInput.value;
  if (!setupCode) {
    setBootstrapMessage('일회용 설정 코드를 입력해 주세요.', true);
    bootstrapCodeInput.focus();
    return;
  }

  bootstrapSubmitButton.disabled = true;
  setBootstrapMessage('Windows의 패스키 저장 위치 선택 창을 여는 중입니다.');
  try {
    await runPasskeyCeremony('register', setupCode);
    bootstrapDialog.close();
    await loadPrivateItems();
    setPrivateMessage('첫 패스키를 등록하고 비공개 기록을 열었습니다.');
  } catch (error) {
    setBootstrapMessage(error.message, true);
  } finally {
    bootstrapSubmitButton.disabled = false;
  }
});

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  setPrivateMessage('패스키 등록 상태를 확인하고 있습니다.');
  try {
    const { registrationAvailable } = await requestJson('/api/passkey/status', { method: 'GET' });
    if (shouldStartPasskeyRegistration(registrationAvailable)) {
      setPrivateMessage('첫 패스키를 등록해 주세요.');
      openBootstrapDialog();
      return;
    }

    setPrivateMessage('패스키를 확인하고 있습니다.');
    await runPasskeyCeremony('authenticate');
    await loadPrivateItems();
  } catch (error) {
    setPrivateMessage(error.message, true);
  } finally {
    loginButton.disabled = false;
  }
});

addPasskeyButton.addEventListener('click', async () => {
  addPasskeyButton.disabled = true;
  setPrivateMessage('새 패스키를 등록하고 있습니다.');
  try {
    await runPasskeyCeremony('register');
    setPrivateMessage('새 패스키를 추가했습니다.');
  } catch (error) {
    setPrivateMessage(error.message, true);
  } finally {
    addPasskeyButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await requestJson('/api/passkey/logout', { method: 'POST', body: '{}' });
  } finally {
    lockPrivateSpace();
    setPrivateMessage('비공개 기록을 다시 잠갔습니다.');
  }
});

const supportsPasskeys = browserSupportsWebAuthn();

if (!supportsPasskeys) {
  loginButton.disabled = true;
  addPasskeyButton.disabled = true;
  setPrivateMessage('이 브라우저에서는 패스키를 사용할 수 없습니다.', true);
} else {
  loadPrivateItems({ quiet: true });
}
