import { supabase, configured } from './supabase.js';
import { esc, fmtDate, qs, icon, setBusy } from './ui.js';
import { getSetting } from './api.js';

const certificateSettings = (await getSetting('certificate')) || {};
const sampleSignatory = document.querySelector('[data-sample-name]');
const sampleTitle = document.querySelector('[data-sample-title]');
const sampleSignature = document.querySelector('[data-sample-signature]');
if (sampleSignatory) sampleSignatory.textContent = certificateSettings.signatory_name || 'Abdulmannan Sulayman';
if (sampleTitle) sampleTitle.textContent = certificateSettings.signatory || 'Director of Studies';
if (sampleSignature && /^https?:\/\//i.test(certificateSettings.signature_url || '')) sampleSignature.innerHTML = `<img src="${esc(certificateSettings.signature_url)}" alt="Signature of ${esc(certificateSettings.signatory_name || 'Abdulmannan Sulayman')}">`;

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
  <h2 style="margin:14px 0 4px">${esc(c.student_name)}</h2><p class="lead" style="max-width:none">completed <strong style="color:var(--ink)">${esc(c.course_title)}</strong> at Courssins Technology Institute.</p>${certificateSettings.signature_url ? `<div style="margin:18px 0"><img src="${esc(certificateSettings.signature_url)}" alt="Signature of ${esc(certificateSettings.signatory_name || 'Director of Studies')}" style="max-width:220px;max-height:70px;object-fit:contain"><p class="muted">${esc(certificateSettings.signatory_name || 'Abdulmannan Sulayman')} · ${esc(certificateSettings.signatory || 'Director of Studies')}</p></div>` : ''}
  <ul class="facts"><li>${icon('award')}<span>Certificate number: <strong>${esc(c.certificate_number)}</strong></span></li><li>${icon('calendar')}<span>Completed ${fmtDate(c.completed_at)}</span></li><li>${icon('clock')}<span>Issued ${fmtDate(c.issued_at)}</span></li></ul></div>`;
}
f.addEventListener('submit', (e) => { e.preventDefault(); verify(f.n.value); });
if (qs('n')) { f.n.value = qs('n'); verify(qs('n')); }

document.getElementById('downloadSampleCertificate')?.addEventListener('click', () => {
  const logo = new URL('assets/images/logo-mark.svg', location.href).href;
  const signature = /^https?:\/\//i.test(certificateSettings.signature_url || '') ? `<img class="signature" src="${esc(certificateSettings.signature_url)}" alt="Signature of ${esc(certificateSettings.signatory_name || 'Abdulmannan Sulayman')}">` : '';
  const name = esc(certificateSettings.signatory_name || 'Abdulmannan Sulayman');
  const title = esc(certificateSettings.signatory || 'Director of Studies');
  const printWindow = window.open('', '_blank');
  if (!printWindow) { window.alert('Allow pop-ups to print or save the sample certificate as a PDF.'); return; }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Courssins Sample Certificate</title><style>*{box-sizing:border-box}body{margin:0;color:#17212b;font:16px Arial,sans-serif}.cert{position:relative;overflow:hidden;background:#fff;border:3px solid #17212b;padding:18px;aspect-ratio:1.414/1;width:100%;margin:0}.inner{height:100%;border:1.5px solid #17212b;padding:38px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:16px;text-align:center;background:radial-gradient(circle at 90% 8%,#eef4d5,transparent 40%)}.brand{width:100%;display:flex;align-items:center;justify-content:center;gap:16px}.brand img{width:58px;height:58px}.brand h1{font-size:26px;margin:0}.brand-copy{text-align:left}.brand-copy small{display:block;margin-top:5px}.who{font-size:40px;font-weight:800;border-bottom:3px solid #c8e34a;padding:0 24px 4px}h2{font-size:26px;margin:8px}small{color:#65716b}.signrow{display:flex;justify-content:space-around;width:100%;gap:16px}.signrow>div{padding-top:6px;min-width:30%;font-size:14px}.signatory{border-top:1.5px solid #17212b}.signature{display:block;width:190px;height:48px;object-fit:contain;margin:0 auto 4px}.watermark{position:absolute;inset:38% 0 auto;color:#a72b2b;opacity:.18;text-align:center;font-size:100px;font-weight:900;letter-spacing:.16em;transform:rotate(-12deg);pointer-events:none}.caption{text-align:center;color:#65716b}@media print{.caption{display:none}@page{size:A4 landscape;margin:12mm}}</style></head><body><main class="cert"><div class="inner"><header class="brand"><img src="${logo}" alt="Courssins logo"><div class="brand-copy"><h1>Courssins Technology Institute</h1><small>Certificate of Completion</small></div></header><section><small>This certifies that</small><div class="who">Student Name</div><p><small>has successfully completed</small></p><h2>Course Title</h2><small>Completion date</small></section><footer class="signrow"><div class="signatory">${signature}<strong>${name}</strong><br><small>${title}</small></div><div>Sample only<br><small>No certificate number</small></div></footer></div><span class="watermark" aria-hidden="true">SAMPLE</span></main><p class="caption">In the print dialog, choose “Save as PDF” to download. This is not an issued certificate and cannot be verified.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
  printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
});
