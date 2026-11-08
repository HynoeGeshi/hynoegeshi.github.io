import { buildSubmissionPayload, EDITING_SERVICE, normalizeService, validateStep } from './booking-utils.mjs?v=editing-timing';
import { trackEvent } from './analytics.js';

const EMAILJS_PUBLIC_KEY = 'FgSokmdb81EHSYZkS';
const EMAILJS_SERVICE_ID = 'service_mp10odw';
const EMAILJS_TEMPLATE_ID = 'template_h0dss6l';
const BOOKING_EMAIL = 'hynoe.flicks@gmail.com';
const STEP_IDS = ['service', 'schedule', 'vision', 'contact', 'review'];
const startedAt = Date.now();

export async function submitBooking(payload) {
  if (!window.emailjs?.send) throw new Error('Booking provider unavailable');
  if (EMAILJS_PUBLIC_KEY) window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: BOOKING_EMAIL,
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

function showErrors(form, fields = [], focus = true) {
  form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  fields.forEach((field) => {
    const el = form.querySelector(`[data-error-for="${field}"]`);
    if (el) el.textContent = field === 'email' ? 'Please enter a valid email address.' : 'Please complete this field before continuing.';
    form.querySelectorAll(`[name="${field}"]`).forEach((input) => input.setAttribute('aria-invalid', 'true'));
  });
  if (focus && fields.length) form.querySelector(`[name="${fields[0]}"]`)?.focus();
}

function bookingEmailBody(payload, editing) {
  const schedule = editing
    ? [`Delivery deadline: ${payload.dateRange}`]
    : [`Date range: ${payload.dateRange}`, `Location: ${payload.location}`];
  return [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Service: ${payload.service}`,
    ...schedule,
    `Budget note: ${payload.budgetNote || ''}`,
    `References: ${payload.references || ''}`,
    '',
    'Details:',
    payload.details || ''
  ].join('\n');
}

function initBooking() {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  const steps = [...form.querySelectorAll('[data-booking-step]')];
  const progress = [...document.querySelectorAll('[data-progress-step]')];
  const status = document.getElementById('submitStatus');
  const fallback = document.getElementById('bookingFallback');
  const fallbackLink = fallback.querySelector('a');
  const copyDetails = fallback.querySelector('details');
  const fallbackText = document.getElementById('bookingFallbackText');
  const submitButton = document.getElementById('submitBooking');
  const reviewBack = form.querySelector('[data-booking-step="review"] [data-back]');
  const shootSchedule = document.getElementById('shootSchedule');
  const editingSchedule = document.getElementById('editingSchedule');
  const scheduleTitle = document.getElementById('scheduleTitle');
  const scheduleCopy = document.getElementById('scheduleCopy');
  const scheduleProgress = document.getElementById('scheduleProgress');
  const visionTitle = document.getElementById('visionTitle');
  const visionCopy = document.getElementById('visionCopy');
  const reviewDateLabel = document.getElementById('reviewDateLabel');
  const reviewLocationRow = document.getElementById('reviewLocationRow');
  const success = document.getElementById('successPanel');
  const formPanel = document.getElementById('bookingPanel');
  let current = 0;
  let submitting = false;
  let started = false;

  const trackStart = (service) => {
    if (!started && normalizeService(service)) {
      started = true;
      trackEvent('booking_start', { service });
    }
  };

  const serviceFromQuery = normalizeService(new URLSearchParams(location.search).get('service'));
  if (serviceFromQuery) {
    const radio = form.querySelector(`input[name="service"][value="${CSS.escape(serviceFromQuery)}"]`);
    if (radio) radio.checked = true;
  }

  const render = () => {
    const editing = editingSchedule && form.elements.service.value === EDITING_SERVICE;
    if (editingSchedule) {
      shootSchedule.hidden = editing;
      editingSchedule.hidden = !editing;
      scheduleTitle.textContent = editing ? 'When do you need the edited photos?' : 'When and where?';
      scheduleCopy.textContent = editing
        ? 'Leave this blank if your timing is flexible.'
        : 'A range is fine if the date is not locked yet.';
      scheduleProgress.textContent = editing ? 'Timing' : 'Date + place';
      visionTitle.textContent = editing ? 'What would you like edited?' : 'What should it feel like?';
      visionCopy.textContent = editing
        ? 'Tell me how many photos you have, what you want changed, and where the final images will appear.'
        : 'References help, but you do not need a full creative brief.';
      reviewDateLabel.textContent = editing ? 'Delivery deadline' : 'Date';
      reviewLocationRow.hidden = editing;
    }
    steps.forEach((step, index) => step.classList.toggle('active', index === current));
    progress.forEach((step, index) => {
      step.classList.toggle('active', index === current);
      step.classList.toggle('done', index < current);
    });
    if (STEP_IDS[current] === 'review') fillReview();
    const firstField = STEP_IDS[current] === 'schedule'
      ? form.elements[editing ? 'editingDeadline' : 'dateRange']
      : steps[current]?.querySelector('input, textarea, button, select');
    firstField?.focus({ preventScroll: true });
  };

  const fillReview = () => {
    const data = buildSubmissionPayload(getFormData(form));
    document.querySelectorAll('[data-review]').forEach((el) => {
      const key = el.dataset.review;
      el.textContent = data[key] || '—';
    });
    if (copyDetails) showEmailOption(data);
  };

  const advance = () => {
    const stepId = STEP_IDS[current];
    const data = getFormData(form);
    const errors = validateStep(stepId, data);
    showErrors(form, errors);
    if (errors.length) return;
    if (stepId === 'service') trackStart(data.service);
    trackEvent('booking_step_complete', { step: current + 1, service: normalizeService(data.service) || 'unknown' });
    current = Math.min(steps.length - 1, current + 1);
    render();
  };

  const hideEmailOption = () => {
    fallback.hidden = true;
    fallbackLink.removeAttribute('href');
    fallbackText.value = '';
    if (copyDetails) copyDetails.open = false;
  };

  const showEmailOption = (payload, expand = false) => {
    const subject = `Booking Request - Hynoe Flicks - ${payload.service || 'Photography'}`;
    const body = bookingEmailBody(payload, Boolean(editingSchedule) && payload.service === EDITING_SERVICE);
    fallbackText.value = body;
    fallbackLink.href = `mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (copyDetails) copyDetails.open = expand;
    fallback.hidden = false;
  };

  const clearSubmissionFeedback = () => {
    status.className = 'submit-status';
    status.textContent = '';
    hideEmailOption();
  };

  const back = () => {
    if (submitting) return;
    clearSubmissionFeedback();
    current = Math.max(0, current - 1);
    render();
  };

  form.querySelectorAll('[data-next]').forEach((button) => button.addEventListener('click', advance));
  form.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', back));

  form.addEventListener('change', (event) => {
    if (event.target.name === 'service') trackStart(event.target.value);
  });

  // Enter advances the current step, while textareas retain normal newline behavior.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && STEP_IDS[current] !== 'review' && event.target.matches('input:not([type=radio])')) {
      event.preventDefault();
      advance();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (STEP_IDS[current] !== 'review') {
      advance();
      return;
    }
    const raw = getFormData(form);
    const contactErrors = validateStep('contact', raw);
    const serviceErrors = validateStep('service', raw);
    const scheduleErrors = validateStep('schedule', raw);
    const errors = [...new Set([...serviceErrors, ...scheduleErrors, ...contactErrors])];
    if (errors.length) {
      clearSubmissionFeedback();
      current = Math.max(0, STEP_IDS.findIndex((id) => validateStep(id, raw).length));
      render();
      showErrors(form, errors);
      return;
    }
    if (raw.website) return;
    if (Date.now() - startedAt < 1800) {
      status.className = 'submit-status show error';
      status.textContent = 'That was unusually fast. Please review the request once, then send again.';
      return;
    }

    submitting = true;
    hideEmailOption();
    const payload = buildSubmissionPayload(raw);
    reviewBack.disabled = true;
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
      status.textContent = 'The site couldn’t confirm the send. Your answers are still here. You can retry or email the request below.';
      showEmailOption(payload, true);
    } finally {
      submitting = false;
      reviewBack.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Send Request';
    }
  });

  render();
}

initBooking();
