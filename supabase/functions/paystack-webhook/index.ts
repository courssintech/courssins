// Supabase Edge Function: receives Paystack webhooks. It is the ONLY thing (besides an admin) that can mark a payment successful.
// Deploy:  supabase functions deploy paystack-webhook --no-verify-jwt
// Then set the webhook URL in the Paystack dashboard to  https://<project>.supabase.co/functions/v1/paystack-webhook
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
Deno.serve(async (req) => {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')!;
  const body = await req.text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  if (sig !== req.headers.get('x-paystack-signature')) return new Response('invalid signature', { status: 401 });
  const event = JSON.parse(body);
  if (event.event !== 'charge.success') return new Response('ignored', { status: 200 });
  const ref = event.data?.reference as string;
  // Never trust the webhook body alone: verify the transaction with Paystack.
  const v = await (await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${secret}` } })).json();
  if (!v.status || v.data?.status !== 'success') return new Response('not successful', { status: 200 });
  // Service role is available only inside this server-side function.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: pay } = await admin.from('payments').select('id,amount,currency,status').eq('reference', ref).maybeSingle();
  if (!pay) return new Response('unknown reference', { status: 200 });
  if (Math.round(Number(pay.amount) * 100) !== v.data.amount || pay.currency !== v.data.currency) return new Response('amount mismatch', { status: 200 });
  if (pay.status !== 'success') await admin.from('payments').update({ status: 'success', raw: v.data }).eq('id', pay.id);
  return new Response('ok', { status: 200 });
});
