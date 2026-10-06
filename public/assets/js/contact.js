import { supabase, configured } from './supabase.js';
import { getSetting } from './api.js';
import { esc, icon, qs, toast, setBusy } from './ui.js';

const site = await getSetting('site') || {};
document.getElementById('contactInfo').innerHTML = [[site.email && `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`, 'mail'], [site.phone && esc(site.phone), 'phone'], [site.address && esc(site.address), 'pin']].filter(([v]) => v).map(([v, i]) => `<li><span class="ic">${icon(i)}</span><span>${v}</span></li>`).join('');
const f = document.getElementById('contactForm'); if (qs('subject')) f.subject.value = qs('subject');
const err = (k, m) => { f.querySelector(`[data-err="${k}"]`).textContent = m || ''; const el = f.elements[k]; if (el) el.setAttribute('aria-invalid', !!m); };
f.addEventListener('submit', async (e) => {
  e.preventDefault(); const a = document.getElementById('cAlert'); a.hidden = true;
  const v = Object.fromEntries(new FormData(f)); let bad = false;
  err('name', v.name.trim() ? '' : (bad = true, 'Enter your name.')); err('email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) ? '' : (bad = true, 'Enter a valid email.')); err('message', v.message.trim().length >= 10 ? '' : (bad = true, 'Write at least 10 characters.'));
  if (bad) return;
  if (!configured) { a.className = 'alert err'; a.textContent = 'Messages switch on once Supabase is connected (see README).'; a.hidden = false; return; }
  const btn = f.querySelector('button[type=submit]'); setBusy(btn, true, 'Sending');
  const { error } = await supabase.from('contact_messages').insert({ name: v.name.trim(), email: v.email.trim(), subject: v.subject.trim() || null, message: v.message.trim() });
  setBusy(btn, false);
  if (error) { a.className = 'alert err'; a.textContent = 'Your message could not be sent. Please try again.'; a.hidden = false; return; }
  f.reset(); a.className = 'alert ok'; a.textContent = 'Thank you. We have received your message and will reply by email.'; a.hidden = false; toast('Message sent', 'ok');
});
