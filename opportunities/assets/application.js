(() => {
  const form = document.querySelector('[data-application-form]');
  if (!form) return;
  const startedAt = form.querySelector('[name="startedAt"]');
  if (startedAt) startedAt.value = String(Date.now());
  const experience = form.querySelector('[name="experience"]');
  const count = form.querySelector('[data-word-count]');
  const button = form.querySelector('button[type="submit"]');
  const initialButton = button.innerHTML;
  let requestKey = crypto.randomUUID();
  let attempted = false;
  let submitting = false;
  const words = () => experience.value.trim() ? experience.value.trim().split(/\s+/).length : 0;
  experience.addEventListener('input', () => {
    if (count) count.textContent = `${words()}/150 words`;
    experience.setCustomValidity(words() > 150 ? 'Please shorten your response to 150 words or fewer.' : '');
  });
  form.addEventListener('input', () => { if (attempted && !submitting) { requestKey = crypto.randomUUID(); attempted = false; } });
  const errorBox = document.createElement('div');
  errorBox.role = 'alert';
  errorBox.className = 'flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800';
  errorBox.hidden = true;
  // The original form shows submission errors immediately above its consent text.
  const stack = button.parentElement;
  stack.insertBefore(errorBox, stack.querySelector('p.text-xs') || button);
  function error(message) {
    errorBox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 size-4 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><span></span>';
    errorBox.querySelector('span').textContent = message;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    errorBox.hidden = true;
    if (!form.reportValidity()) return;
    if (!form.querySelector('[name="researchInterest"]:checked')) { error('Please select a research direction.'); return; }
    if (words() > 150) { error('Please shorten your response to 150 words or fewer.'); return; }
    const data = new FormData(form);
    if (['cv', 'supplemental'].some(key => data.get(key) instanceof File && data.get(key).size > 10 * 1024 * 1024)) {
      error('Each uploaded PDF must be 10 MB or smaller.'); return;
    }
    submitting = true;
    attempted = true;
    button.disabled = true;
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 animate-spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading documents…';
    try {
      const endpoint = window.DEEPREAL_APPLICATION_ENDPOINT;
      if (!endpoint) throw new Error('Applications are temporarily unavailable. Please try again shortly.');
      const response = await fetch(endpoint, { method: 'POST', body: data, headers: { 'Idempotency-Key': requestKey } });
      const result = await response.json();
      if (!response.ok || !result.applicationId) throw new Error(result.error || 'We could not submit your application. Please try again.');
      const card = form.parentElement;
      card.innerHTML = `<div class="flex min-h-[520px] flex-col items-center justify-center text-center" role="status"><span class="grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-700"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg></span><p class="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Submission received</p><h2 class="mt-2 text-2xl font-bold tracking-tight text-[#0b1f3a]">Thank you for your interest.</h2><p class="mt-3 max-w-md text-sm leading-6 text-slate-600">Your information and documents have been received. Qualified applicants will be contacted about a possible interview.</p><div class="mt-6 rounded-xl bg-[#f4f7fb] px-5 py-3"><span class="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Application ID</span><span data-received-id class="mt-1 block font-mono text-sm font-bold text-[#0b1f3a]"></span></div><a href="https://deep-real.github.io/opening.html" class="mt-8 text-sm font-bold text-[#c75800] hover:underline">Return to open positions</a></div>`;
      card.querySelector('[data-received-id]').textContent = result.applicationId;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (failure) {
      error(failure instanceof Error ? failure.message : 'We could not submit your application. Please try again.');
      button.disabled = false;
      button.innerHTML = initialButton;
      submitting = false;
    }
  });
})();
