import { isReducedMotion, setExpanded } from './site-utils.mjs';
import { trackEvent } from './analytics.js';

function byId(id) { return document.getElementById(id); }

export function initSiteChrome() {
  const header = document.querySelector('.site-header');
  const toggle = byId('navToggle');
  const mobileNav = byId('mobileNav');
  const menuLinks = [...(mobileNav?.querySelectorAll('a') || [])];
  const menuControls = [toggle, ...menuLinks].filter(Boolean);
  const mobileBook = byId('mobileBook');
  const hero = document.querySelector('.hero, .service-hero');
  const desktopLayout = window.matchMedia('(min-width: 981px)');
  toggle?.setAttribute('aria-controls', 'mobileNav');

  const menuIsOpen = () => mobileNav?.classList.contains('open');

  const closeMenu = () => {
    if (!menuIsOpen()) return;
    mobileNav?.classList.remove('open');
    setExpanded(toggle, false);
    toggle?.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
  };

  toggle?.addEventListener('click', () => {
    if (menuIsOpen()) {
      closeMenu();
      return;
    }
    mobileNav?.classList.add('open');
    setExpanded(toggle, true);
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.style.overflow = 'hidden';
    toggle.focus();
  });

  // A menu opened on a phone must not leave desktop scrolling locked.
  desktopLayout.addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });

  menuLinks.forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (!menuIsOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      toggle?.focus();
      return;
    }
    if (event.key !== 'Tab') return;

    const activeIndex = menuControls.indexOf(document.activeElement);
    const tabIndex = activeIndex === -1
      ? (event.shiftKey ? menuControls.length - 1 : 0)
      : (activeIndex + (event.shiftKey ? -1 : 1) + menuControls.length) % menuControls.length;
    event.preventDefault();
    menuControls[tabIndex]?.focus();
  });

  const visibleBookingLinks = new Set();
  const updateScrollState = () => {
    const y = window.scrollY || 0;
    header?.classList.toggle('scrolled', y > 28);
    if (mobileBook) {
      const trigger = hero ? hero.offsetHeight * 0.72 : 460;
      mobileBook.classList.toggle('visible', y > trigger && visibleBookingLinks.size === 0);
    }
  };
  if (mobileBook && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleBookingLinks.add(entry.target);
        else visibleBookingLinks.delete(entry.target);
      }
      updateScrollState();
    });
    document.querySelectorAll('main a.button.gold[href^="booking.html"]').forEach((link) => observer.observe(link));
  }
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
