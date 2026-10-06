import { supabase, configured, getSession, getProfile, homeFor, safeNext, setRemember } from './supabase.js';
import { getCourses } from './api.js';
import { qs, setBusy, toast } from './ui.js';
import { icon } from './icons.js';

const page = document.body.dataset.authPage;
const $ = (id) => document.getElementById(id);
const alertBox = (el, msg, type = 'err') => { el.className = `alert ${type}`; el.textContent = msg; el.hidden = !msg; };
const fieldErr = (form, k, m) => { const e = form.querySelector(`[data-err="${k}"]`); if (e) e.textContent = m || ''; const i = form.querySelector(`#${k}`); if (i) i.setAttribute('aria-invalid', m ? 'true' : 'false'); return !m; };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
document.querySelectorAll('[data-toggle-pw]').forEach((b) => b.addEventListener('click', () => {
  const i = b.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password';
  b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.innerHTML = icon(show ? 'eye-off' : 'eye');
}));
const offline = () => { const a = $('authAlert') || $('forgotAlert'); if (!configured && a) alertBox(a, 'Accounts switch on once Supabase is connected. Add your keys in assets/js/config.js (see README).', 'info'); };
offline();

async function redirectAfterLogin() {
  const p = await getProfile(true); const next = safeNext(qs('next'));
  location.replace(next && !(next.startsWith('admin') && p.role === 'student') ? next : homeFor(p.role));
}

if (page === 'login') {
  const panels = { login: $('loginPanel'), forgot: $('forgotPanel'), reset: $('resetPanel') };
  const show = (k) => Object.entries(panels).forEach(([n, el]) => (el.hidden = n !== k));
  if (configured) { if (await getSession() && !location.hash.includes('type=recovery')) redirectAfterLogin(); }
  if (configured) supabase.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') show('reset'); });
  $('forgotBtn').addEventListener('click', () => { show('forgot'); $('fEmail').value = $('email').value; $('fEmail').focus(); });
  $('backLogin').addEventListener('click', () => show('login'));

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; alertBox($('authAlert'), '');
    const email = $('email').value.trim(), pw = $('password').value;
    const ok = [fieldErr(f, 'email', EMAIL.test(email) ? '' : 'Enter a valid email address.'), fieldErr(f, 'password', pw ? '' : 'Enter your password.')].every(Boolean);
    if (!ok) return;
    if (!configured) return offline();
    const btn = f.querySelector('button[type=submit]'); setBusy(btn, true, 'Logging in');
    setRemember($('remember').checked);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { setBusy(btn, false); return alertBox($('authAlert'), /confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox for the confirmation link.' : 'Email or password is incorrect.'); }
    await redirectAfterLogin();
  });
  $('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const email = $('fEmail').value.trim();
    if (!fieldErr(f, 'fEmail', EMAIL.test(email) ? '' : 'Enter a valid email address.')) return;
    if (!configured) return offline();
    const btn = f.querySelector('button'); setBusy(btn, true, 'Sending');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login.html` });
    setBusy(btn, false);
    alertBox($('forgotAlert'), error ? 'Could not send the reset email. Please try again shortly.' : 'If an account exists for that email, a reset link is on its way.', error ? 'err' : 'ok');
  });
  $('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const pw = $('newPw').value;
    if (!fieldErr(f, 'newPw', pw.length >= 8 ? '' : 'Use at least 8 characters.')) return;
    const btn = f.querySelector('button'); setBusy(btn, true, 'Updating');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(btn, false);
    if (error) return alertBox($('resetAlert'), error.message);
    toast('Password updated', 'ok'); await redirectAfterLogin();
  });
}

if (page === 'signup') {
  const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Cameroon', 'Benin', 'Togo', 'Senegal', 'Ivory Coast', 'Egypt', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda', 'United Kingdom', 'United States', 'Canada', 'Germany', 'United Arab Emirates', 'India', 'Other'];
  $('country').innerHTML = '<option value="">Select country</option>' + COUNTRIES.map((c) => `<option>${c}</option>`).join('');
  const courses = await getCourses();
  $('interest').innerHTML = '<option value="">Select a programme</option>' + courses.map((c) => `<option>${c.title.replace(/</g, '&lt;')}</option>`).join('') + '<option>Not sure yet</option>';
  const pre = qs('course'); if (pre) [...$('interest').options].forEach((o) => { if (o.text === pre) o.selected = true; });
  if (configured && await getSession()) redirectAfterLogin();
  $('password').addEventListener('input', () => {
    const v = $('password').value; let s = 0; if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
    const b = $('strengthBar'); b.style.width = `${s * 25}%`; b.style.background = ['#d92d20', '#d92d20', '#f5a300', '#8fcf1c', '#2e9e3f'][s];
  });
  $('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; alertBox($('authAlert'), '');
    const v = { full_name: $('full_name').value.trim(), email: $('email').value.trim(), phone: $('phone').value.trim(), country: $('country').value, interest: $('interest').value, password: $('password').value, confirm: $('confirm').value };
    const ok = [
      fieldErr(f, 'full_name', v.full_name.length >= 3 && /\s/.test(v.full_name) ? '' : 'Enter your first and last name.'),
      fieldErr(f, 'email', EMAIL.test(v.email) ? '' : 'Enter a valid email address.'),
      fieldErr(f, 'phone', /^\+?[0-9\s\-()]{7,20}$/.test(v.phone) ? '' : 'Enter a valid phone number.'),
      fieldErr(f, 'country', v.country ? '' : 'Choose your country.'),
      fieldErr(f, 'interest', v.interest ? '' : 'Choose a programme.'),
      fieldErr(f, 'password', v.password.length >= 8 && /[A-Za-z]/.test(v.password) && /\d/.test(v.password) ? '' : 'Use 8+ characters with letters and numbers.'),
      fieldErr(f, 'confirm', v.confirm === v.password ? '' : 'Passwords do not match.'),
    ].every(Boolean);
    const agree = $('agree').checked; f.querySelector('[data-err="agree"]').textContent = agree ? '' : 'Please accept the terms to continue.';
    if (!ok || !agree) return;
    if (!configured) return offline();
    const btn = f.querySelector('button[type=submit]'); setBusy(btn, true, 'Creating account');
    setRemember(true);
    const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { emailRedirectTo: `${location.origin}/login.html`, data: { full_name: v.full_name, phone: v.phone, country: v.country, interest: v.interest } } });
    setBusy(btn, false);
    if (error) return alertBox($('authAlert'), /registered|exists/i.test(error.message) ? 'An account with this email already exists. Try logging in.' : error.message);
    if (data.session) return void (location.replace(safeNext(qs('next')) || 'dashboard.html'));
    f.reset(); alertBox($('authAlert'), 'Account created. Check your email for a confirmation link, then log in.', 'ok');
  });
}
