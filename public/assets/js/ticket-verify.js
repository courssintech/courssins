import { supabase, configured } from './supabase.js';
import { esc, fmtDate, icon, setBusy } from './ui.js';

const form = document.getElementById('ticketVerifyForm');
const output = document.getElementById('ticketVerifyOut');
async function verify(code) {
  code = code.trim(); if (!code) return;
  if (!configured) { output.innerHTML = '<div class="alert err">Ticket verification is unavailable until Supabase is configured.</div>'; return; }
  const button = form.querySelector('button'); setBusy(button, true, 'Checking');
  const { data, error } = await supabase.rpc('verify_event_ticket', { p_code: code }); setBusy(button, false);
  const ticket = data?.[0];
  if (error || !ticket) { output.innerHTML = `<div class="alert err" style="margin-top:20px">${error ? 'Ticket verification is temporarily unavailable.' : `No ticket found for ${esc(code)}.`}</div>`; return; }
  const valid = ticket.status === 'valid';
  output.innerHTML = `<article class="panel" style="margin-top:20px"><span class="badge ${valid ? 'ok' : 'err'}">${valid ? 'Valid ticket' : `Ticket ${esc(ticket.status)}`}</span><h2 style="margin-top:12px">${esc(ticket.event_title)}</h2><ul class="facts"><li>${icon('user')}<span>Attendee: ${esc(ticket.attendee_name)}</span></li><li>${icon('calendar')}<span>${fmtDate(ticket.event_starts_at)}</span></li><li>${icon('pin')}<span>${esc(ticket.location || 'Location not set')}</span></li><li>${icon('calendar')}<span>Code: ${esc(ticket.ticket_code)}</span></li></ul></article>`;
}
form.addEventListener('submit', (event) => { event.preventDefault(); verify(form.code.value); });
const code = new URLSearchParams(location.search).get('code'); if (code) { form.code.value = code; verify(code); }
