import { nextIndex, normalizeCategory, previousIndex } from './gallery-utils.mjs';
import { trackEvent } from './analytics.js';

function picture(item, loading = 'lazy') {
  const img = document.createElement('img');
  img.src = item.card || item.large || item.thumb;
  img.alt = item.alt || item.caption || 'Hynoe Flicks portfolio photograph';
  img.loading = loading;
  img.decoding = 'async';
  if (item.width) img.width = item.width;
  if (item.height) img.height = item.height;
  img.addEventListener('error', () => {
    img.hidden = true;
    img.closest('.gallery-item')?.classList.add('image-failed');
  }, { once: true });
  return img;
}

export function initGallery(root, items = []) {
  if (!root || !items.length) return;
  const grid = root.querySelector('[data-gallery-grid]');
  const filters = [...root.querySelectorAll('[data-gallery-filter]')];
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImage');
  const lbCaption = document.getElementById('lightboxCaption');
  const close = document.getElementById('lightboxClose');
  const prev = document.getElementById('lightboxPrev');
  const next = document.getElementById('lightboxNext');
  let activeCategory = 'all';
  let visibleItems = items;
  let activeIndex = 0;
  let lastFocus = null;
  let touchStartX = 0;

  const render = () => {
    visibleItems = activeCategory === 'all'
      ? items
      : items.filter((item) => normalizeCategory(item.category) === activeCategory);
    grid.innerHTML = '';
    visibleItems.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-item';
      button.dataset.galleryIndex = String(index);
      button.setAttribute('aria-label', `Open ${item.caption || item.category || 'portfolio image'}`);
      button.appendChild(picture(item));
      const meta = document.createElement('span');
      meta.className = 'gallery-meta';
      meta.innerHTML = `<span>${item.caption || 'Hynoe Flicks'}</span><b>${item.category || 'Portfolio'}</b>`;
      button.appendChild(meta);
      button.addEventListener('click', () => openLightbox(index, button));
      grid.appendChild(button);
    });
    trackEvent('portfolio_view', { category: activeCategory, count: visibleItems.length });
  };

  const updateLightbox = () => {
    const item = visibleItems[activeIndex];
    if (!item || !lbImg) return;
    lbImg.src = item.large || item.card || item.thumb;
    lbImg.alt = item.alt || item.caption || 'Hynoe Flicks portfolio photograph';
    if (lbCaption) lbCaption.textContent = `${item.category || 'Portfolio'} — ${item.caption || 'Hynoe Flicks'}`;
  };

  const openLightbox = (index, trigger) => {
    if (!lightbox) return;
    activeIndex = index;
    lastFocus = trigger || document.activeElement;
    updateLightbox();
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    close?.focus();
    trackEvent('lightbox_open', { category: visibleItems[index]?.category || 'portfolio' });
  };

  const closeLightbox = () => {
    if (!lightbox || lightbox.getAttribute('aria-hidden') === 'true') return;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lastFocus?.focus?.();
  };

  const step = (direction) => {
    activeIndex = direction > 0
      ? nextIndex(activeIndex, visibleItems.length)
      : previousIndex(activeIndex, visibleItems.length);
    if (activeIndex >= 0) updateLightbox();
  };

  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      activeCategory = normalizeCategory(filter.dataset.galleryFilter);
      filters.forEach((button) => button.setAttribute('aria-pressed', button === filter ? 'true' : 'false'));
      render();
      trackEvent('portfolio_category_click', { category: activeCategory });
    });
  });

  close?.addEventListener('click', closeLightbox);
  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));
  lightbox?.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });
  lightbox?.addEventListener('touchstart', (event) => { touchStartX = event.touches[0]?.clientX || 0; }, { passive: true });
  lightbox?.addEventListener('touchend', (event) => {
    const dx = (event.changedTouches[0]?.clientX || 0) - touchStartX;
    if (Math.abs(dx) > 42) step(dx < 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('keydown', (event) => {
    if (!lightbox || lightbox.getAttribute('aria-hidden') !== 'false') return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowRight') step(1);
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'Tab') {
      const controls = [close, prev, next].filter(Boolean);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  render();
}

async function boot() {
  const root = document.querySelector('[data-gallery]');
  if (!root) return;
  try {
    const response = await fetch('assets/data/portfolio.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Portfolio request failed: ${response.status}`);
    const items = await response.json();
    initGallery(root, items);
  } catch (error) {
    console.error(error);
    const grid = root.querySelector('[data-gallery-grid]');
    if (grid) grid.innerHTML = '<div class="gallery-empty">Portfolio is being refreshed. You can still book a shoot or contact Hynoe Flicks directly.</div>';
  }
}

boot();
