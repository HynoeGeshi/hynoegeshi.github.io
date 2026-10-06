import { buildSubmissionPayload, normalizeService, validateStep } from './booking-utils.mjs';
import { trackEvent } from './analytics.js';

const EMAILJS_PUBLIC_KEY = 'FgSokmdb81EHSYZkS';
const EMAILJS_SERVICE_ID = 'service_mp10odw';
const EMAILJS_TEMPLATE_ID = 'template_h0dss6l';
const STEP_IDS = ['service', 'schedule', 'vision', 'contact', 'review'];
const startedAt = Date.now();

export async function submitBooking(payload) {
  if (!window.emailjs?.send) throw new Error('Booking provider unavailable');
  if (EMAILJS_PUBLIC_KEY) window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: 'hynoe.flicks@gmail.com',
    from_name: payload.name,
    reply_to: payload.email,
    service: payload.service,
    date_range: payload.dateRange,
    location: payload.location,
    budget_note: payload.budgetNote || '',
    details: [payload.details, payload.references ? `References: ${payload.references}` : ''].filter(Boolean).join('\n\n')
  });
  return { ok: true };
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showErrors(form, fields = []) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  fields.forEach((field) => {
    const el = form.querySelector(`[data-error-for="${field}"]`);
    if (el) el.textContent = 'Please complete this field before continuing.';
    form.elements[field]?.focus?.();
  });
}

function fallbackMailto(payload) {
  const subject = encodeURIComponent(`Booking Request - Hynoe Flicks - ${payload.service || 'Photography'}`);
  const body = encodeURIComponent([
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Service: ${payload.service}`,
    `Date range: ${payload.dateRange}`,
    `Location: ${payload.location}`,
    `Budget note: ${payload.budgetNote || ''}`,
    `References: ${payload.references || ''}`,
    '',
    'Details:',
    payload.details || ''
  ].join('\n'));
  return `mailto:hynoe.flicks@gmail.com?subject=${subject}&body=${body}`;
}

function initBooking() {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  const steps = [...form.querySelectorAll('[data-booking-step]')];
  const progress = [...document.querySelectorAll('[data-progress-step]')];
  const status = document.getElementById('submitStatus');
  const success = document.getElementById('successPanel');
  const formPanel = document.getElementById('bookingPanel');
  let current = 0;

  const serviceFromQuery = normalizeService(new URLSearchParams(location.search).get('service'));
  if (serviceFromQuery) {
    const radio = form.querySelector(`input[name="service"][value="${CSS.escape(serviceFromQuery)}"]`);
    if (radio) radio.checked = true;
  }

  const render = () => {
    steps.forEach((step, index) => step.classList.toggle('active', index === current));
    progress.forEach((step, index) => {
      step.classList.toggle('active', index === current);
      step.classList.toggle('done', index < current);
    });
    if (STEP_IDS[current] === 'review') fillReview();
    steps[current]?.querySelector('input, textarea, button, select')?.focus?.({ preventScroll: true });
  };

  const fillReview = () => {
    const data = buildSubmissionPayload(getFormData(form));
    document.querySelectorAll('[data-review]').forEach((el) => {
      const key = el.dataset.review;
      el.textContent = data[key] || '—';
    });
  };

  const advance = () => {
    const stepId = STEP_IDS[current];
    const data = getFormData(form);
    const errors = validateStep(stepId, data);
    showErrors(form, errors);
    if (errors.length) return;
    trackEvent('booking_step_complete', { step: current + 1, service: normalizeService(data.service) || 'unknown' });
    current = Math.min(steps.length - 1, current + 1);
    render();
  };

  const back = () => {
    current = Math.max(0, current - 1);
    render();
  };

  form.querySelectorAll('[data-next]').forEach((button) => button.addEventListener('click', advance));
  form.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', back));

  form.addEventListener('change', (event) => {
    if (event.target.name === 'service') trackEvent('booking_start', { service: event.target.value });
  }, { once: true });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const raw = getFormData(form);
    const contactErrors = validateStep('contact', raw);
    const serviceErrors = validateStep('service', raw);
    const scheduleErrors = validateStep('schedule', raw);
    const errors = [...new Set([...serviceErrors, ...scheduleErrors, ...contactErrors])];
    if (errors.length) {
      showErrors(form, errors);
      current = Math.max(0, STEP_IDS.findIndex((id) => validateStep(id, raw).length));
      render();
      return;
    }
    if (raw.website) return;
    if (Date.now() - startedAt < 1800) {
      status.className = 'submit-status show error';
      status.textContent = 'That was unusually fast. Please review the request once, then send again.';
      return;
    }

    const payload = buildSubmissionPayload(raw);
    const submitButton = document.getElementById('submitBooking');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    status.className = 'submit-status show';
    status.textContent = 'Sending your request…';
    trackEvent('booking_submit', { service: payload.service });

    try {
      await submitBooking(payload);
      trackEvent('booking_success', { service: payload.service });
      status.className = 'submit-status show success';
      status.textContent = 'Sent.';
      formPanel.hidden = true;
      success.classList.add('show');
      success.querySelector('h2')?.focus?.();
    } catch (error) {
      console.error(error);
      trackEvent('booking_error', { service: payload.service });
      status.className = 'submit-status show error';
      status.innerHTML = `The request did not send, but your answers are still here. <a href="${fallbackMailto(payload)}">Open a pre-filled email instead</a>.`;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send Request';
    }
  });

  render();
}

initBooking();
