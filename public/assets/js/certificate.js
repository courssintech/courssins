import { supabase, configured } from './supabase.js';
import { esc, fmtDate, qs, icon, setBusy } from './ui.js';

const f = document.getElementById('verifyForm'), out = document.getElementById('verifyOut');
async function verify(n) {
  n = n.trim(); if (!n) return;
  if (!configured) { out.innerHTML = '<div class="alert err" style="margin-top:20px">Verification switches on once Supabase is connected (see README).</div>'; return; }
  const btn = f.querySelector('button'); setBusy(btn, true, 'Checking');
  const { data, error } = await supabase.rpc('verify_certificate', { p_number: n });
  setBusy(btn, false);
  if (error) { out.innerHTML = '<div class="alert err" style="margin-top:20px">Verification is unavailable right now. Please try again.</div>'; return; }
  const c = data?.[0];
  if (!c) { out.innerHTML = `<div class="verify-result" style="box-shadow:10px 10px 0 #ffc7c0"><h2>No certificate found</h2><p class="muted" style="margin-top:8px">We could not find a certificate numbered <strong>${esc(n)}</strong>. Check the number and try again.</p></div>`; return; }
  const ok = c.status === 'valid';
  out.innerHTML = `<div class="verify-result"><span class="badge ${ok ? 'ok' : 'err'}">${ok ? 'Valid certificate' : 'This certificate has been revoked'}</span>
  <h2 style="margin:14px 0 4px">${esc(c.student_name)}</h2><p class="lead" style="max-width:none">completed <strong style="color:var(--ink)">${esc(c.course_title)}</strong> at Courssins Technology Institute.</p>
  <ul class="facts"><li>${icon('award')}<span>Certificate number: <strong>${esc(c.certificate_number)}</strong></span></li><li>${icon('calendar')}<span>Completed ${fmtDate(c.completed_at)}</span></li><li>${icon('clock')}<span>Issued ${fmtDate(c.issued_at)}</span></li></ul></div>`;
}
f.addEventListener('submit', (e) => { e.preventDefault(); verify(f.n.value); });
if (qs('n')) { f.n.value = qs('n'); verify(qs('n')); }
