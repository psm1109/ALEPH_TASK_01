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
const galleryImages = Array.from({ length: 6 }, (_, index) => `images/${index + 1}.jpg`);
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
