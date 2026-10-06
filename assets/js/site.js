import { isReducedMotion, setExpanded } from './site-utils.mjs';
import { trackEvent } from './analytics.js';

function byId(id) { return document.getElementById(id); }

export function initSiteChrome() {
  const header = document.querySelector('.site-header');
  const toggle = byId('navToggle');
  const mobileNav = byId('mobileNav');
  const mobileBook = byId('mobileBook');
  const hero = document.querySelector('.hero, .service-hero');

  const closeMenu = () => {
    mobileNav?.classList.remove('open');
    setExpanded(toggle, false);
    document.body.style.overflow = '';
  };

  toggle?.addEventListener('click', () => {
    const next = !mobileNav?.classList.contains('open');
    mobileNav?.classList.toggle('open', next);
    setExpanded(toggle, next);
    document.body.style.overflow = next ? 'hidden' : '';
  });

  mobileNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const updateScrollState = () => {
    const y = window.scrollY || 0;
    header?.classList.toggle('scrolled', y > 28);
    if (mobileBook) {
      const trigger = hero ? hero.offsetHeight * 0.72 : 460;
      mobileBook.classList.toggle('visible', y > trigger);
    }
  };
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });

  document.querySelectorAll('[data-track-service]').forEach((el) => {
    el.addEventListener('click', () => trackEvent('service_view', { service: el.dataset.trackService }));
  });
  document.querySelectorAll('a[href*="instagram.com"]').forEach((el) => {
    el.addEventListener('click', () => trackEvent('instagram_click'));
  });
  document.querySelectorAll('a[href^="mailto:"]').forEach((el) => {
    el.addEventListener('click', () => trackEvent('email_click'));
  });

  if (isReducedMotion()) document.documentElement.dataset.reducedMotion = 'true';

  const year = byId('year');
  if (year) year.textContent = new Date().getFullYear();
}

initSiteChrome();
