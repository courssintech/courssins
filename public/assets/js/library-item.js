import { supabase, configured } from './supabase.js';
import { CONFIG } from './config.js';
import { esc, money, toast, setBusy, empty } from './ui.js';

const panel = document.getElementById('bookPanel');
const id = new URLSearchParams(location.search).get('id');
if (!configured || !id) panel.innerHTML = empty('Book unavailable', 'Open a valid library share link.');
else {
  const { data: item, error } = await supabase.from('library').select('*').eq('id', id).eq('published', true).maybeSingle();
  if (error || !item) panel.innerHTML = empty('Book unavailable', 'This library item may have been removed.');
  else {
    const { data: sessionResult } = await supabase.auth.getSession();
    const session = sessionResult?.session;
    let purchased = item.pricing !== 'paid' || Number(item.price) <= 0;
    if (session && item.pricing === 'paid') {
      const { data: purchase } = await supabase.from('library_purchases').select('status').eq('library_id', item.id).eq('user_id', session.user.id).maybeSingle();
      purchased = purchase?.status === 'paid';
    }
    const pdf = Boolean(item.object_path) || /\.pdf(?:$|[?#])/i.test(item.url || '');
    let fullUrl = item.url || '';
    if (item.object_path && purchased) { const { data: signed } = await supabase.storage.from('library-files').createSignedUrl(item.object_path, 1800); fullUrl = signed?.signedUrl || ''; }
    document.title = `${item.title} | Courssins Library`;
    document.getElementById('bookTitle').textContent = item.title;
    document.getElementById('bookDescription').textContent = item.description || '';
    const shareUrl = location.href;
    panel.innerHTML = `<div class="tools"><div class="grow"><span class="chip">${item.pricing === 'paid' ? money(item.price, item.currency) : 'Free'} · ${esc(item.type)}</span></div><button class="btn btn-outline btn-sm" id="shareBook">Copy share link</button></div><p class="muted">Share this page URL with readers. ${pdf ? 'The preview below shows up to the first six pages.' : ''}</p>${pdf ? '<div id="pdfPreview" class="list" style="margin-top:18px"></div>' : item.cover_url ? `<img src="${esc(item.cover_url)}" alt="${esc(item.title)} cover" style="max-width:240px;margin:18px auto;border-radius:12px">` : ''}<div id="bookAction" class="btn-row" style="margin-top:20px"></div>`;
    document.getElementById('shareBook').addEventListener('click', async () => { try { await navigator.clipboard.writeText(shareUrl); toast('Share link copied', 'ok'); } catch { toast(shareUrl, 'ok'); } });
    if (pdf && Array.isArray(item.preview_urls) && item.preview_urls.length) {
      const host = document.getElementById('pdfPreview');
      host.innerHTML = item.preview_urls.slice(0, 6).map((src, index) => `<article class="panel"><h3>Preview · page ${index + 1}</h3><img src="${esc(src)}" alt="${esc(item.title)} preview page ${index + 1}" loading="lazy" style="display:block;width:100%;max-width:760px;margin:auto;border:1px solid var(--line);border-radius:8px"></article>`).join('');
    } else if (pdf && fullUrl) {
      const host = document.getElementById('pdfPreview');
      try {
        const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
        const documentPdf = await pdfjs.getDocument(item.url).promise;
        const pages = Math.min(6, documentPdf.numPages);
        for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
          const page = await documentPdf.getPage(pageNo), viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height; canvas.style.cssText = 'width:100%;max-width:760px;height:auto;border:1px solid var(--line);border-radius:8px;background:#fff';
          const wrap = document.createElement('article'); wrap.className = 'panel'; wrap.innerHTML = `<h3>Preview · page ${pageNo}</h3>`; wrap.append(canvas); host.append(wrap);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch { host.innerHTML = '<div class="alert info">PDF preview is unavailable in this browser. Open the book after access is granted.</div>'; }
    }
    const action = document.getElementById('bookAction');
    if (item.access === 'members' && !session) action.innerHTML = '<a class="btn btn-dark" href="login.html?next=library.html">Log in to access this book</a>';
    else if (purchased) action.innerHTML = fullUrl ? `<a class="btn btn-lime" href="${esc(fullUrl)}" target="_blank" rel="noopener noreferrer">Open full ${esc(item.type)}</a>` : '<span class="alert err">The file could not be opened right now.</span>';
    else if (!session) action.innerHTML = '<a class="btn btn-dark" href="login.html?next=library.html">Log in to purchase</a>';
    else action.innerHTML = `<button class="btn btn-lime" id="buyBook">Purchase for ${money(item.price, item.currency)}</button>`;
    document.getElementById('buyBook')?.addEventListener('click', async (event) => {
      setBusy(event.currentTarget, true, 'Starting');
      const { data, error: purchaseError } = await supabase.rpc('start_library_purchase', { p_library: item.id });
      if (purchaseError) { setBusy(event.currentTarget, false); return toast(purchaseError.message, 'err'); }
      if (data.status === 'paid') { location.reload(); return; }
      if (!CONFIG.PAYMENT_INIT_URL) { setBusy(event.currentTarget, false); return toast(`Payment is not configured. Reference: ${data.reference}`, 'err'); }
      try {
        const response = await fetch(CONFIG.PAYMENT_INIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ reference: data.reference, callback_url: location.href }) });
        const result = await response.json(); if (!response.ok || !result.authorization_url) throw new Error(result.error || 'Payment could not start');
        location.assign(result.authorization_url);
      } catch (paymentError) { setBusy(event.currentTarget, false); toast(paymentError.message || 'Payment could not start.', 'err'); }
    });
  }
}
