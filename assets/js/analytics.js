import { sanitizeAnalyticsProperties } from './analytics-utils.mjs';

export function trackEvent(name, properties = {}) {
  const detail = { name, properties: sanitizeAnalyticsProperties(properties) };
  window.dispatchEvent(new CustomEvent('hynoe:analytics', { detail }));
  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: name, ...detail.properties });
  }
}
