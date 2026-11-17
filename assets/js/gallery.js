import { nextIndex, normalizeCategory, previousIndex } from './gallery-utils.mjs';
import { trackEvent } from './analytics.js';

export function initGallery(root) {
  const grid = root?.querySelector('[data-gallery-grid]');
  if (!grid) return;
  const items = [...grid.querySelectorAll('a.gallery-item')].map((link) => ({
    link,
    image: link.querySelector('img'),
    category: link.querySelector('.gallery-meta b').textContent,
    caption: link.querySelector('.gallery-meta span').textContent,
  }));
  if (!items.length) return;
  const controls = root.querySelector('[data-gallery-controls]');
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

  const selectCategory = (filter) => {
    const category = normalizeCategory(filter?.dataset.galleryFilter);
    if (category !== activeCategory) {
      activeCategory = category;
      visibleItems = category === 'all'
        ? items
        : items.filter((item) => normalizeCategory(item.category) === category);
      grid.replaceChildren(...visibleItems.map((item) => item.link));
    }
    filters.forEach((button) => button.setAttribute('aria-pressed', String(button === filter)));
    trackEvent('portfolio_view', { category: activeCategory, count: visibleItems.length });
  };

  const updateLightbox = () => {
    const item = visibleItems[activeIndex];
    if (!item || !lbImg) return;
    lbImg.src = item.link.href;
    lbImg.alt = item.image.alt;
    if (lbCaption) lbCaption.textContent = `${item.category} — ${item.caption}`;
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
      selectCategory(filter);
      trackEvent('portfolio_category_click', { category: activeCategory });
    });
  });

  if (lightbox && lbImg) {
    items.forEach((item) => {
      item.link.setAttribute('aria-haspopup', 'dialog');
      item.link.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        openLightbox(visibleItems.indexOf(item), item.link);
      });
    });
  }

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
  const filterFromFragment = () => filters.find((filter) => filter.dataset.galleryFragment === window.location.hash.slice(1));
  window.addEventListener('hashchange', () => {
    const filter = filterFromFragment();
    if (filter) selectCategory(filter);
  });
  selectCategory(filterFromFragment() || filters[0]);
  if (controls) controls.hidden = false;
}

function legacyCard(item) {
  const caption = item.caption || 'Hynoe Flicks';
  const category = item.category || 'Portfolio';
  const link = document.createElement('a');
  link.className = 'gallery-item';
  link.href = item.large || item.card || item.thumb;
  link.setAttribute('aria-label', `Open ${caption} ${category}`);
  const image = document.createElement('img');
  image.src = item.card || item.large || item.thumb;
  image.alt = item.alt || caption;
  image.loading = 'lazy';
  image.decoding = 'async';
  const meta = document.createElement('span');
  meta.className = 'gallery-meta';
  const captionLabel = document.createElement('span');
  captionLabel.textContent = caption;
  const categoryLabel = document.createElement('b');
  categoryLabel.textContent = category;
  meta.append(captionLabel, ' ', categoryLabel);
  link.append(image, meta);
  return link;
}

async function bootGallery(root) {
  const grid = root?.querySelector('[data-gallery-grid]');
  if (!grid) return;

  // An older homepage can still request this module by its unversioned URL.
  if (!grid.childElementCount && !root.querySelector('[data-gallery-controls]')) {
    try {
      const response = await fetch('assets/data/portfolio.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Portfolio request failed: ${response.status}`);
      const items = await response.json();
      grid.replaceChildren(...items.map(legacyCard));
    } catch (error) {
      console.error(error);
      const message = document.createElement('div');
      message.className = 'gallery-empty';
      message.textContent = 'Portfolio is being refreshed. You can still request a quote or contact Hynoe Flicks directly.';
      grid.replaceChildren(message);
      return;
    }
  }
  initGallery(root);
}

bootGallery(document.querySelector('[data-gallery]'));
