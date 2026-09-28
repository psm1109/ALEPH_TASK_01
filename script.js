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
const managePasskeysButton = document.querySelector('[data-passkey-manage]');
const managePasskeysDialog = document.querySelector('[data-passkey-manage-dialog]');
const managePasskeysList = document.querySelector('[data-passkey-list]');
const managePasskeysMessage = document.querySelector('[data-passkey-manage-message]');
const managePasskeysCloseButtons = document.querySelectorAll('[data-passkey-manage-close]');
const bootstrapDialog = document.querySelector('[data-passkey-bootstrap-dialog]');
const bootstrapForm = document.querySelector('[data-passkey-bootstrap-form]');
const bootstrapCodeInput = document.querySelector('[data-passkey-bootstrap-code]');
const bootstrapNameInput = document.querySelector('[data-passkey-bootstrap-name]');
const bootstrapSubmitButton = document.querySelector('[data-passkey-bootstrap-submit]');
const bootstrapMessage = document.querySelector('[data-passkey-bootstrap-message]');
const bootstrapCancelButtons = document.querySelectorAll('[data-passkey-bootstrap-cancel]');

const setPrivateMessage = (message, isError = false) => {
  privateMessage.textContent = message;
  privateMessage.classList.toggle('is-error', isError);
};

const formatPasskeyDate = (value) => {
  if (!value) return '사용 기록 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const setManagePasskeysMessage = (message, isError = false) => {
  managePasskeysMessage.textContent = message;
  managePasskeysMessage.classList.toggle('is-error', isError);
};

const loadPasskeys = async () => {
  setManagePasskeysMessage('패스키 목록을 불러오고 있습니다.');
  const { passkeys } = await requestJson('/api/passkey/credentials', { method: 'GET' });
  managePasskeysList.replaceChildren();

  passkeys.forEach((passkey) => {
    const item = document.createElement('article');
    const details = document.createElement('div');
    const heading = document.createElement('h3');
    const location = document.createElement('p');
    const dates = document.createElement('p');
    const actions = document.createElement('div');
    const renameButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    item.className = 'passkey-list-item';
    details.className = 'passkey-list-details';
    heading.textContent = passkey.bootstrap ? `${passkey.name} · 최초 등록` : passkey.name;
    location.textContent = passkey.location;
    dates.className = 'passkey-list-dates';
    dates.textContent = `추가 ${formatPasskeyDate(passkey.createdAt)} · 최근 사용 ${formatPasskeyDate(passkey.lastUsedAt)}`;
    actions.className = 'passkey-list-actions';
    renameButton.type = 'button';
    renameButton.className = 'passkey-rename';
    renameButton.textContent = '이름 변경';
    renameButton.addEventListener('click', async () => {
      const displayName = window.prompt('새 패스키 이름을 입력해 주세요.', passkey.name);
      if (displayName === null) return;
      if (!displayName.trim() || displayName.trim().length > 40) {
        setManagePasskeysMessage('패스키 이름을 1~40자로 입력해 주세요.', true);
        return;
      }
      renameButton.disabled = true;
      setManagePasskeysMessage('패스키 이름을 저장하고 있습니다.');
      try {
        await requestJson('/api/passkey/credentials', {
          method: 'PATCH',
          body: JSON.stringify({ credentialId: passkey.id, displayName }),
        });
        await loadPasskeys();
        setManagePasskeysMessage('패스키 이름을 변경했습니다.');
      } catch (error) {
        renameButton.disabled = false;
        setManagePasskeysMessage(error.message, true);
      }
    });
    deleteButton.type = 'button';
    deleteButton.className = 'passkey-delete';
    deleteButton.textContent = '삭제';
    deleteButton.disabled = passkeys.length <= 1;
    if (deleteButton.disabled) deleteButton.title = '마지막 패스키는 삭제할 수 없습니다.';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`${passkey.name}를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
      deleteButton.disabled = true;
      setManagePasskeysMessage('패스키를 삭제하고 있습니다.');
      try {
        await requestJson('/api/passkey/credentials', {
          method: 'DELETE',
          body: JSON.stringify({ credentialId: passkey.id }),
        });
        await loadPasskeys();
        setManagePasskeysMessage('패스키를 삭제했습니다.');
      } catch (error) {
        deleteButton.disabled = false;
        setManagePasskeysMessage(error.message, true);
      }
    });

    details.append(heading, location, dates);
    actions.append(renameButton, deleteButton);
    item.append(details, actions);
    managePasskeysList.append(item);
  });

  setManagePasskeysMessage('');
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
  bootstrapNameInput.focus();
};

bootstrapCancelButtons.forEach((button) => button.addEventListener('click', () => {
  bootstrapCodeInput.value = '';
  bootstrapNameInput.value = '';
  bootstrapDialog.close();
}));

bootstrapDialog.addEventListener('close', () => {
  bootstrapCodeInput.value = '';
  bootstrapNameInput.value = '';
  bootstrapSubmitButton.disabled = false;
});

bootstrapForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const setupCode = bootstrapCodeInput.value;
  const displayName = bootstrapNameInput.value.trim();
  if (!displayName) {
    setBootstrapMessage('패스키 이름을 입력해 주세요.', true);
    bootstrapNameInput.focus();
    return;
  }
  if (!setupCode) {
    setBootstrapMessage('일회용 설정 코드를 입력해 주세요.', true);
    bootstrapCodeInput.focus();
    return;
  }

  bootstrapSubmitButton.disabled = true;
  setBootstrapMessage('Windows의 패스키 저장 위치 선택 창을 여는 중입니다.');
  try {
    await runPasskeyCeremony('register', { setupCode, displayName });
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
  const displayName = window.prompt('이 패스키를 알아볼 수 있는 이름을 입력해 주세요.\n예: 회사 노트북 Windows Hello');
  if (displayName === null) {
    setPrivateMessage('패스키 추가를 취소했습니다.');
    return;
  }
  if (!displayName.trim() || displayName.trim().length > 40) {
    setPrivateMessage('패스키 이름을 1~40자로 입력해 주세요.', true);
    return;
  }
  addPasskeyButton.disabled = true;
  setPrivateMessage('새 패스키를 등록하고 있습니다.');
  try {
    await runPasskeyCeremony('register', { displayName });
    setPrivateMessage('새 패스키를 추가했습니다.');
  } catch (error) {
    setPrivateMessage(error.message, true);
  } finally {
    addPasskeyButton.disabled = false;
  }
});

document.querySelector('[data-passkey-new-account]').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const displayName = window.prompt('새 검증 계정의 패스키 이름을 입력해 주세요.');
  if (displayName === null) return;
  if (!displayName.trim() || displayName.trim().length > 40) {
    setPrivateMessage('패스키 이름을 1~40자로 입력해 주세요.', true);
    return;
  }
  button.disabled = true;
  try {
    await runPasskeyCeremony('register', { displayName, newAccount: true });
    await loadPrivateItems();
    setPrivateMessage('새 검증 계정으로 전환했습니다. 잠근 뒤 각 패스키로 자료를 확인해 주세요.');
  } catch (error) {
    setPrivateMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

managePasskeysButton.addEventListener('click', async () => {
  managePasskeysButton.disabled = true;
  managePasskeysDialog.showModal();
  try {
    await loadPasskeys();
  } catch (error) {
    setManagePasskeysMessage(error.message, true);
  } finally {
    managePasskeysButton.disabled = false;
  }
});

managePasskeysCloseButtons.forEach((button) => button.addEventListener('click', () => {
  managePasskeysDialog.close();
}));

logoutButton.addEventListener('click', async () => {
  try {
    await requestJson('/api/passkey/logout', { method: 'POST', body: '{}' });
  } finally {
    if (managePasskeysDialog.open) managePasskeysDialog.close();
    lockPrivateSpace();
    setPrivateMessage('비공개 기록을 다시 잠갔습니다.');
  }
});

const supportsPasskeys = browserSupportsWebAuthn();

if (!supportsPasskeys) {
  loginButton.disabled = true;
  addPasskeyButton.disabled = true;
  managePasskeysButton.disabled = true;
  setPrivateMessage('이 브라우저에서는 패스키를 사용할 수 없습니다.', true);
} else {
  loadPrivateItems({ quiet: true });
}
