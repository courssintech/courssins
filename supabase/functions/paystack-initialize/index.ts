// Supabase Edge Function: starts a Paystack payment for a PENDING payment row that belongs to the logged-in user.
// Deploy:  supabase functions deploy paystack-initialize
// Secrets: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx   (the secret lives ONLY here, never in the website)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in' }, 401);
    const { reference, callback_url } = await req.json();
    // RLS guarantees this only returns the caller's own payment
    const { data: pay } = await userClient.from('payments').select('reference,amount,currency,status').eq('reference', reference).maybeSingle();
    if (!pay || pay.status !== 'pending') return json({ error: 'No pending payment found' }, 404);
    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, amount: Math.round(Number(pay.amount) * 100), currency: pay.currency, reference: pay.reference, callback_url }),
    });
    const j = await r.json();
    if (!j.status) return json({ error: j.message ?? 'Paystack error' }, 502);
    return json({ authorization_url: j.data.authorization_url });
  } catch (e) { return json({ error: String(e) }, 500); }
});
