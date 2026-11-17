import { buildSubmissionPayload, EDITING_SERVICE, normalizeService, validateStep } from './booking-utils.mjs?v=booking-request';
import { trackEvent } from './analytics.js';

const EMAILJS_PUBLIC_KEY = 'FgSokmdb81EHSYZkS';
const EMAILJS_SERVICE_ID = 'service_mp10odw';
const EMAILJS_TEMPLATE_ID = 'template_h0dss6l';
const BOOKING_EMAIL = 'hynoe.flicks@gmail.com';
const EMAILJS_SCRIPT = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
const SLOW_SEND_MS = 8000;
const MAILTO_BODY_LIMIT = 2000;
const STEP_IDS = ['service', 'schedule', 'vision', 'contact', 'review'];
const PROJECT_HINTS = {
  Portraits: 'Tell me who’s being photographed and what you need the portraits for.',
  Nightlife: 'Share the kind of party or club night, the vibe and anything you want covered.',
  'Music / Artist Content': 'Tell me whether this is a live set or artist promo shoot and where you’ll use the photos.',
  Events: 'Share the approximate coverage window and any people or moments I should capture.',
  'Brand + Lifestyle': 'Tell me what you’re promoting and where the brand photos will appear.',
  [EDITING_SERVICE]: 'Tell me how many photos you have, what you want changed and where the final images will appear.'
};
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
    : [
        payload.dateRange && `Date range: ${payload.dateRange}`,
        payload.location && `Location: ${payload.location}`
      ].filter(Boolean);
  return [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Service: ${payload.service}`,
    ...schedule,
    payload.budgetNote && `Budget note: ${payload.budgetNote}`,
    payload.references && `References: ${payload.references}`,
    payload.details && `\nDetails:\n${payload.details}`
  ].filter(Boolean).join('\n');
}

function initBooking() {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  const steps = [...form.querySelectorAll('[data-booking-step]')];
  const progress = [...document.querySelectorAll('[data-progress-step]')];
  const status = document.getElementById('submitStatus');
  const unavailable = document.getElementById('bookingUnavailable');
  const progressWrap = document.getElementById('bookingProgress');
  const questions = document.getElementById('bookingQuestions');
  const fallback = document.getElementById('bookingFallback');
  const fallbackLink = fallback.querySelector('a');
  const copyDetails = fallback.querySelector('details');
  const fallbackText = document.getElementById('bookingFallbackText');
  const copyButton = document.getElementById('copyBookingText');
  const copyStatus = document.getElementById('copyBookingStatus');
  const submitButton = document.getElementById('submitBooking');
  const submitLabel = submitButton.textContent;
  const reviewTitle = document.getElementById('bookingReviewTitle');
  const reviewCopy = document.getElementById('bookingReviewCopy');
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
  const reviewDetails = form.querySelector('[data-review="details"]');
  const reviewLongDetails = document.getElementById('reviewLongDetails');
  const reviewExpandedDetails = document.getElementById('reviewExpandedDetails');
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
    if (radio) {
      radio.checked = true;
      current = 1;
      trackStart(serviceFromQuery);
    }
  }

  const siteSendEnabled = form.dataset.siteSend === 'enabled';
  const canSendThroughSite = () => siteSendEnabled && Boolean(window.emailjs?.send);
  const updateSiteSend = () => {
    const available = canSendThroughSite();
    submitButton.hidden = !available;
    if (reviewCopy) {
      reviewCopy.textContent = available
        ? 'Send your request online or from your email app. I’ll follow up about timing, scope and a quote.'
        : 'Send your request from your email app. I’ll follow up about timing, scope and a quote.';
    }
  };

  const render = (focus = true) => {
    const service = form.elements.service.value;
    const editing = editingSchedule && service === EDITING_SERVICE;
    if (editingSchedule) {
      shootSchedule.hidden = editing;
      editingSchedule.hidden = !editing;
      scheduleTitle.textContent = editing ? 'When do you need the edited photos?' : 'When and where?';
      scheduleCopy.textContent = editing
        ? 'Leave this blank if your timing is flexible.'
        : 'You can leave either field blank if you’re still planning.';
      scheduleProgress.textContent = editing ? 'Timing' : 'Date + place';
      visionTitle.textContent = editing ? 'What would you like edited?' : 'Tell me about the project';
      visionCopy.textContent = PROJECT_HINTS[service] || 'A few details help me put together a quote.';
      reviewDateLabel.textContent = editing ? 'Delivery deadline' : 'Date';
      reviewLocationRow.hidden = editing;
    }
    steps.forEach((step, index) => step.classList.toggle('active', index === current));
    progress.forEach((step, index) => {
      step.classList.toggle('active', index === current);
      step.classList.toggle('done', index < current);
      if (index === current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    if (STEP_IDS[current] === 'review') {
      fillReview();
      updateSiteSend();
    }
    if (focus) steps[current]?.querySelector('h2[tabindex="-1"], input, textarea, button, select')?.focus();
  };

  const fillReview = () => {
    const data = buildSubmissionPayload(getFormData(form));
    form.querySelectorAll('[data-review]').forEach((el) => {
      const value = data[el.dataset.review];
      el.textContent = value || '—';
      const row = el.closest('[data-optional-review]');
      if (row) row.hidden = !value;
    });
    if (reviewLongDetails) {
      const long = data.details.length > 240 || data.details.split('\n').length > 4;
      reviewDetails.hidden = long;
      reviewLongDetails.hidden = !long;
      reviewLongDetails.open = false;
      reviewExpandedDetails.textContent = long ? data.details : '';
    }
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
    if (copyStatus) copyStatus.textContent = '';
    if (copyDetails) copyDetails.open = false;
  };

  const showEmailOption = (payload, expand = false) => {
    const subject = `Booking Request - Hynoe Flicks - ${payload.service || 'Photography'}`;
    const body = bookingEmailBody(payload, Boolean(editingSchedule) && payload.service === EDITING_SERVICE);
    const withSubject = `mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}`;
    const withBody = `${withSubject}&body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`;
    const longDraft = withBody.length > MAILTO_BODY_LIMIT;
    fallbackText.value = body;
    fallbackLink.href = longDraft ? withSubject : withBody;
    fallbackLink.textContent = longDraft ? 'Open your email app' : 'Open a prefilled email';
    if (copyDetails) copyDetails.open = expand || longDraft;
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
  copyButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fallbackText.value);
      copyStatus.textContent = 'Request copied.';
    } catch {
      fallbackText.focus();
      fallbackText.select();
      copyStatus.textContent = 'Request selected. Use your device’s copy command.';
    }
  });

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
    if (!canSendThroughSite()) return;
    const raw = getFormData(form);
    const errors = [...validateStep('service', raw), ...validateStep('contact', raw)];
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
    const slowSend = window.setTimeout(() => {
      status.textContent = 'Sending is taking longer than usual. If you email instead, your request may arrive twice.';
      showEmailOption(payload, true);
    }, SLOW_SEND_MS);

    try {
      await submitBooking(payload);
      hideEmailOption();
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
      status.textContent = 'The site couldn’t confirm the send. You can email your request or retry.';
      showEmailOption(payload, true);
      if (reviewTitle && document.activeElement === document.body) fallbackLink.focus();
    } finally {
      window.clearTimeout(slowSend);
      submitting = false;
      reviewBack.disabled = false;
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
    }
  });

  render(false);
  updateSiteSend();
  formPanel.hidden = false;
  if (unavailable) unavailable.hidden = true;
  if (progressWrap) progressWrap.hidden = false;
  if (questions) questions.hidden = false;
  if (siteSendEnabled) {
    const script = document.createElement('script');
    script.src = EMAILJS_SCRIPT;
    script.addEventListener('load', updateSiteSend, { once: true });
    document.head.append(script);
  }
}

initBooking();
