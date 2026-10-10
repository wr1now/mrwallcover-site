import { validateAttachments } from '../lib/enquiry-attachments.ts';
import { preferencesFromJSON, preferenceSummary, PREFERENCE_KEY } from '../lib/material-advice.ts';
import { emptyEnquiry, PROFESSIONAL_AUDIENCES, makeReference, sanitiseEvent, validateEnquiry, type EnquiryFields } from '../lib/enquiry.ts';

const DRAFT_KEY = 'mw-brief-draft';

function readForm(form: HTMLFormElement): EnquiryFields {
  const value = (name: string) => {
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) return String(field.value || '');
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) return field.value;
    return '';
  };
  const marketing = form.querySelector<HTMLInputElement>('input[name="marketing"]');
  return emptyEnquiry({
    kind: form.dataset.variant === 'aftercare' ? 'aftercare' : 'enquiry',
    name: value('name'),
    email: value('email'),
    phone: value('phone'),
    replyBy: value('replyBy'),
    message: value('message'),
    audience: value('audience'),
    intent: value('intent'),
    area: value('area'),
    rooms: value('rooms'),
    wallNotes: value('wallNotes'),
    product: value('product'),
    timing: value('timing'),
    access: value('access'),
    programme: value('programme'),
    materialResponsibility: value('materialResponsibility'),
    specificationNotes: value('specificationNotes'),
    materialPreferences: value('materialPreferences'),
    budget: value('budget'),
    marketing: Boolean(marketing?.checked),
    shortlist: value('shortlist'),
    honeypot: value('_honey'),
    idempotencyKey: value('idempotencyKey'),
    projectReference: value('projectReference'),
  });
}

function showErrors(form: HTMLFormElement, errors: Record<string, string>) {
  form.querySelectorAll<HTMLElement>('[data-error]').forEach((node) => {
    node.textContent = '';
  });
  for (const [key, message] of Object.entries(errors)) {
    const slot = form.querySelector<HTMLElement>(`[data-error="${key}"]`);
    const field = form.querySelector<HTMLElement>(`[name="${key}"]`);
    if (slot) slot.textContent = message;
    if (field) field.setAttribute('aria-invalid', 'true');
  }
  const summary = form.querySelector<HTMLElement>('[data-error-summary]');
  if (summary) {
    const items = Object.entries(errors).filter(([, message]) => message);
    summary.hidden = items.length === 0;
    summary.innerHTML = items.map(([key, message]) => `<a href="#field-${key}">${message}</a>`).join(' ');
    if (items.length) summary.focus();
  }
}

function clearInvalid(form: HTMLFormElement) {
  form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
}

function saveDraft(form: HTMLFormElement) {
  const fields = readForm(form);
  const draft = {
    audience: fields.audience,
    intent: fields.intent,
    area: fields.area,
    rooms: fields.rooms,
    timing: fields.timing,
    budget: fields.budget,
    materialResponsibility: fields.materialResponsibility,
  };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private mode */
  }
}

function restoreDraft(form: HTMLFormElement) {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(draft)) {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        if (!field.value) field.value = value;
      }
    }
  } catch {
    /* ignore broken drafts */
  }
}

function shortlistValue(): string {
  try {
    const raw = localStorage.getItem('mw-shortlist');
    const slugs = raw ? (JSON.parse(raw) as string[]) : [];
    return (Array.isArray(slugs) ? slugs : []).filter((slug) => /^[a-z0-9-]{2,60}$/.test(slug)).join(',');
  } catch {
    return '';
  }
}

function track(name: string, detail: Record<string, unknown>) {
  const sink = (window as unknown as { __mwTrack?: (event: string, payload: Record<string, unknown>) => void }).__mwTrack;
  if (typeof sink === 'function') sink(name, sanitiseEvent(detail));
}

export function bindEnquiryForm(form: HTMLFormElement) {
  const params = new URLSearchParams(window.location.search);
  const intent = form.querySelector<HTMLSelectElement>('[name="intent"]');
  const audience = form.querySelector<HTMLSelectElement>('[name="audience"]');
  if (intent && params.get('intent')) intent.value = params.get('intent') || '';
  if (audience && params.get('audience')) audience.value = params.get('audience') || '';
  const shortlist = form.querySelector<HTMLInputElement>('[name="shortlist"]');
  if (shortlist) shortlist.value = form.dataset.variant === 'aftercare' ? '' : shortlistValue();
  restoreDraft(form);

  const builder = form.querySelector<HTMLElement>('[data-builder]');
  const openBuilder = form.querySelector<HTMLButtonElement>('[data-open-builder]');
  const steps = [...form.querySelectorAll<HTMLElement>('[data-step]')];
  let stepIndex = 0;
  let idempotencyKey = '';
  let sending = false;

  // A visitor can return from the provider's CAPTCHA with the page restored from the back/forward cache.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    sending = false;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]');
    if (submit) submit.disabled = false;
  });

  const showStep = (index: number) => {
    stepIndex = index;
    steps.forEach((step, i) => {
      step.hidden = i !== index;
    });
    const label = form.querySelector<HTMLElement>('[data-step-label]');
    if (label) label.textContent = `Step ${index + 1} of ${steps.length}`;
    const back = form.querySelector<HTMLButtonElement>('[data-step-back]');
    const next = form.querySelector<HTMLButtonElement>('[data-step-next]');
    if (back) back.disabled = index === 0;
    if (next) next.hidden = index === steps.length - 1;
    track('project_step_complete', { step: index + 1, intent: intent?.value || '' });
  };

  const syncProfessional = () => {
    const pro = PROFESSIONAL_AUDIENCES.some((value) => value === audience?.value);
    const help = form.querySelector<HTMLElement>('[data-professional-help]');
    const prompts: Record<string, string> = { designer: 'Include material codes, sample status, focal points and the elevations that define the finish.', developer: 'Include room or floor phases, drawing revisions, wall readiness and any tender deadline.', hotel: 'Include occupied areas, room-release dates, working hours and maintenance requirements.', commercial: 'Include the scope, programme and who supplies the material.' };
    if (help) help.textContent = prompts[audience?.value || ''] || '';
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-pro] input, [data-pro] textarea').forEach((field) => { field.disabled = !pro; });
    form.querySelectorAll<HTMLElement>('[data-pro]').forEach((node) => {
      node.hidden = !pro;
    });
  };
  audience?.addEventListener('change', syncProfessional);
  syncProfessional();
  if (audience && PROFESSIONAL_AUDIENCES.some((value) => value === audience.value)) {
    if (builder) builder.hidden = false;
    if (openBuilder) openBuilder.hidden = true;
    showStep(0);
  }
  const preferencesField = form.querySelector<HTMLInputElement>('[name="materialPreferences"]');
  const selection = form.querySelector<HTMLElement>('[data-selection-summary]');
  try {
    const preferences = preferencesFromJSON(sessionStorage.getItem(PREFERENCE_KEY) || '');
    if (preferences && preferencesField && form.dataset.variant !== 'aftercare') {
      preferencesField.value = JSON.stringify(preferences);
      if (selection) { selection.hidden = false; selection.querySelector('[data-selection-text]')!.textContent = preferenceSummary(preferences); }
    }
  } catch { /* Optional session choices. */ }
  form.querySelector('[data-clear-selection]')?.addEventListener('click', () => {
    if (preferencesField) preferencesField.value = '';
    if (selection) selection.hidden = true;
    try { sessionStorage.removeItem(PREFERENCE_KEY); } catch { /* Optional persistence. */ }
  });


  const syncReply = () => {
    const reply = form.querySelector<HTMLInputElement>('input[name="replyBy"]:checked')?.value;
    const email = form.querySelector<HTMLElement>('[data-reply="email"]');
    const phone = form.querySelector<HTMLElement>('[data-reply="phone"]');
    if (email) email.hidden = reply === 'phone';
    if (phone) phone.hidden = reply === 'email';
  };
  form.querySelectorAll('input[name="replyBy"]').forEach((input) => input.addEventListener('change', syncReply));
  syncReply();

  openBuilder?.addEventListener('click', () => {
    if (builder) builder.hidden = false;
    openBuilder.hidden = true;
    showStep(0);
    track('project_start', { intent: intent?.value || 'unspecified' });
  });

  form.querySelector('[data-step-next]')?.addEventListener('click', () => {
    saveDraft(form);
    if (stepIndex < steps.length - 1) showStep(stepIndex + 1);
  });
  form.querySelector('[data-step-back]')?.addEventListener('click', () => {
    if (stepIndex > 0) showStep(stepIndex - 1);
  });

  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
  const fileList = form.querySelector<HTMLElement>('[data-file-list]');
  const attachmentProvider = form.dataset.leadApi ? 'lead-api' : form.dataset.provider || '';
  const attachmentError = () => validateAttachments([...(fileInput?.files || [])], attachmentProvider);
  const showAttachmentError = () => {
    const error = attachmentError();
    const slot = form.querySelector<HTMLElement>('[data-error="attachment"]');
    if (slot) slot.textContent = error || '';
    if (error) fileInput?.setAttribute('aria-invalid', 'true');
    else fileInput?.removeAttribute('aria-invalid');
    const summary = form.querySelector<HTMLElement>('[data-error-summary]');
    if (summary && !summary.hidden) {
      const result = validateEnquiry(readForm(form));
      clearInvalid(form);
      showErrors(form, { ...(!result.ok ? result.errors : {}), ...(error ? { attachment: error } : {}) });
    }
  };
  const renderFiles = () => {
    if (!fileInput || !fileList) return;
    const files = [...(fileInput.files || [])];
    showAttachmentError();
    fileList.innerHTML = '';
    files.forEach((file, index) => {
      const row = document.createElement('li');
      row.textContent = `${file.name} (${Math.ceil(file.size / 1024)} KB)`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-line';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const next = new DataTransfer();
        files.forEach((item, itemIndex) => {
          if (itemIndex !== index) next.items.add(item);
        });
        fileInput.files = next.files;
        renderFiles();
      });
      row.append(remove);
      fileList.append(row);
    });
  };
  fileInput?.addEventListener('change', renderFiles);

  form.addEventListener('submit', async (event) => {
    if (shortlist) shortlist.value = form.dataset.variant === 'aftercare' ? '' : shortlistValue();
    const fields = readForm(form);
    const validated = validateEnquiry(fields);
    const uploadError = attachmentError();
    clearInvalid(form);
    if (!validated.ok || uploadError) {
      event.preventDefault();
      if (!validated.ok && validated.spam) return;
      showErrors(form, { ...(!validated.ok ? validated.errors : {}), ...(uploadError ? { attachment: uploadError } : {}) });
      return;
    }
    showErrors(form, {});
    if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
    const keyField = form.querySelector<HTMLInputElement>('[name="idempotencyKey"]');
    if (keyField) keyField.value = idempotencyKey;
    const referenceField = form.querySelector<HTMLInputElement>('[name="reference"]');
    const reference = referenceField?.value || makeReference();
    if (referenceField && !referenceField.value) referenceField.value = reference;

    const leadApi = form.dataset.leadApi || '';
    const status = form.querySelector<HTMLElement>('[data-status]');
    const button = form.querySelector<HTMLButtonElement>('[type="submit"]');
    if (leadApi) {
      event.preventDefault();
      if (sending) return;
      sending = true;
      if (button) button.disabled = true;
      if (status) {
        status.hidden = false;
        status.textContent = 'Sending…';
      }
      try {
        const response = await fetch(`${leadApi}/api/leads`, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'idempotency-key': idempotencyKey },
        });
        if (response.status === 204) return;
        const payload = (await response.json()) as { reference?: string; error?: string; received?: boolean; notification?: string };
        if (!response.ok || !payload.reference) {
          if (status) status.textContent = payload.error || 'The enquiry was not stored. Your answers are still on this page. You can try again, or email info@mrwallcover.com.';
          track('upload_failure', { status: response.status });
          if (button) button.disabled = false;
          sending = false;
          return;
        }
        track('enquiry_received', { kind: validated.value.kind, notification: payload.notification || 'unknown' });
        if (payload.notification === 'failed') track('notification_failed', { kind: validated.value.kind });
        form.querySelectorAll<HTMLElement>('[data-hide-on-success]').forEach((node) => {
          node.hidden = true;
        });
        const receipt = form.querySelector<HTMLElement>('[data-receipt]');
        if (receipt) {
          receipt.hidden = false;
          const ref = receipt.querySelector('[data-reference]');
          if (ref) ref.textContent = payload.reference;
          const note = receipt.querySelector('[data-notification]');
          if (note) {
            // Same line whether or not the notification went through: the page never claims a reply or proof of delivery.
            note.textContent = 'Your enquiry is saved under this reference. If you have not heard back, email info@mrwallcover.com and quote it.';
          }
        }
        try {
          sessionStorage.setItem('mw-receipt', JSON.stringify({ reference: payload.reference, channel: 'api' }));
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
      } catch {
        if (status) status.textContent = 'The enquiry was not stored. Your answers are still on this page. Try again, or email info@mrwallcover.com.';
        if (button) button.disabled = false;
        sending = false;
      }
      return;
    }

    const endpoint = form.dataset.endpoint;
    if (endpoint && form.dataset.provider === 'formsubmit') {
      try {
        sessionStorage.setItem('mw-receipt', JSON.stringify({ reference, channel: 'formsubmit' }));
      } catch {
        /* ignore */
      }
      form.action = atob(endpoint).split('').reverse().join('');
      // Return to the thank-you page on the origin the visitor is actually using. A hard-coded
      // https URL lands on a certificate warning while the custom domain's certificate is not
      // live, and sessionStorage (the receipt) is per origin, so http and https must not mix.
      const next = form.querySelector<HTMLInputElement>('[name="_next"]');
      if (next && /^https?:$/.test(window.location.protocol)) next.value = `${window.location.origin}/thank-you/`;
      if (button) button.disabled = true;
      return;
    }
  });
}

const form = document.querySelector<HTMLFormElement>('[data-enquiry-form]');
if (form) bindEnquiryForm(form);
