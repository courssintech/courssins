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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Courssins Sample Certificate</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f3f5f2;color:#17212b;font:16px 'Plus Jakarta Sans',Arial,sans-serif}.cert{position:relative;overflow:hidden;background:#fff;border:3px solid #17212b;padding:18px;aspect-ratio:1.414/1;width:min(100%,1120px);margin:24px auto}.inner{height:100%;border:1.5px solid #17212b;padding:clamp(22px,4vw,48px);display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:20px;text-align:center;background:radial-gradient(circle at 90% 8%,#eef4d5,transparent 40%)}h1{font-size:clamp(1.4rem,3vw,2.2rem);margin:8px 0}h2{font-size:clamp(1.2rem,3vw,2rem);margin:8px}small{color:#65716b}.who{font-size:clamp(1.4rem,4.4vw,3rem);font-weight:800;border-bottom:3px solid #c8e34a;padding:0 24px 4px}.signrow{display:flex;justify-content:space-around;width:100%;gap:16px}.signrow>div{padding-top:6px;min-width:30%;font-size:.85rem}.signatory{border-top:1.5px solid #17212b}.signature{display:block;width:min(190px,100%);height:48px;object-fit:contain;margin:0 auto 4px}.watermark{position:absolute;inset:38% 0 auto;color:#a72b2b;opacity:.18;text-align:center;font-size:clamp(3rem,12vw,8rem);font-weight:900;letter-spacing:.16em;transform:rotate(-12deg);pointer-events:none}.print{display:block;margin:18px auto;padding:10px 18px;background:#17212b;color:#fff;border:0;border-radius:8px;cursor:pointer}@media(max-width:600px){.cert{aspect-ratio:auto;min-height:340px}.inner{min-height:300px}}@media print{body{padding:0;background:#fff}.cert{width:100%;margin:0;break-inside:avoid}.print{display:none}@page{size:landscape;margin:12mm}}</style></head><body><main class="cert"><div class="inner"><header><img src="${logo}" width="54" height="54" alt="Courssins logo"><h1>Courssins Technology Institute</h1><small>Certificate of Completion</small></header><section><small>This certifies that</small><div class="who">Student Name</div><p><small>has successfully completed</small></p><h2>Course Title</h2><small>Completion date</small></section><footer class="signrow"><div class="signatory">${signature}<strong>${name}</strong><br><small>${title}</small></div><div>Sample only<br><small>No certificate number</small></div></footer></div><span class="watermark" aria-hidden="true">SAMPLE</span></main><p style="text-align:center;color:#65716b">Sample preview — not an issued certificate and cannot be verified.</p><button class="print" onclick="window.print()">Print or save as PDF</button></body></html>`;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a'); link.href = blobUrl; link.download = 'Courssins-Sample-Certificate.html'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
});
