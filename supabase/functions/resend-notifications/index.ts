import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const siteUrl = Deno.env.get('SITE_URL') ?? 'https://courssin.com.ng';
const allowedOrigins = new Set([new URL(siteUrl).origin, 'http://localhost:8000', 'http://127.0.0.1:8000']);
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const json = (body: unknown, status = 200, origin = siteUrl) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  },
});

async function hash(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? siteUrl;
  if (!allowedOrigins.has(origin)) return json({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  } });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const recipient = Deno.env.get('CONTACT_NOTIFY_EMAIL')?.trim();
  const sender = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!resendKey || !recipient || !sender || !supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Email notification service is not configured' }, 503, origin);
  }
  if (!emailPattern.test(recipient) || !/^.+<[^<>]+@[^<>]+>$/.test(sender) && !emailPattern.test(sender)) {
    return json({ error: 'Email notification sender or recipient is invalid' }, 500, origin);
  }

  try {
    const { type, source_id } = await req.json();
    if (!['contact', 'newsletter'].includes(type) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source_id || '')) {
      return json({ error: 'Invalid notification request' }, 400, origin);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let email: string;
    let subject: string;
    let text: string;
    let replyTo: string | undefined;

    if (type === 'contact') {
      const { data, error } = await admin.from('contact_messages').select('name,email,subject,message').eq('id', source_id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Contact message not found' }, 404, origin);
      email = String(data.email).trim().toLowerCase();
      if (!emailPattern.test(email)) return json({ error: 'Contact email is invalid' }, 400, origin);
      subject = `Website contact${data.subject ? `: ${String(data.subject).replace(/[\r\n]+/g, ' ').slice(0, 160)}` : ''}`;
      text = `New contact form message\n\nName: ${String(data.name).slice(0, 120)}\nEmail: ${email}\nSubject: ${String(data.subject || 'Not provided').slice(0, 200)}\n\nMessage:\n${String(data.message).slice(0, 4000)}`;
      replyTo = email;
    } else {
      const { data, error } = await admin.from('newsletter_subscribers').select('email').eq('id', source_id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'Membership signup not found' }, 404, origin);
      email = String(data.email).trim().toLowerCase();
      if (!emailPattern.test(email)) return json({ error: 'Signup email is invalid' }, 400, origin);
      subject = 'New membership email signup';
      text = `A new email address joined the Courssins membership list.\n\nEmail: ${email}`;
    }

    const senderHash = await hash(email, resendKey);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await admin.from('email_notification_deliveries')
      .select('source_id', { count: 'exact', head: true })
      .eq('sender_hash', senderHash)
      .gte('created_at', since);
    if (rateError) throw rateError;
    if ((count ?? 0) >= 5) return json({ error: 'Too many notifications for this email. Try again later.' }, 429, origin);

    const { error: claimError } = await admin.from('email_notification_deliveries').insert({ source_type: type, source_id, sender_hash: senderHash });
    if (claimError?.code === '23505') return json({ ok: true, duplicate: true }, 200, origin);
    if (claimError) throw claimError;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: sender, to: [recipient], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!resendResponse.ok) {
      await admin.from('email_notification_deliveries').delete().eq('source_type', type).eq('source_id', source_id);
      console.error('[resend-notifications] Resend rejected notification:', resendResponse.status);
      return json({ error: 'Email notification could not be delivered' }, 502, origin);
    }

    const { error: sentError } = await admin.from('email_notification_deliveries').update({ sent_at: new Date().toISOString() }).eq('source_type', type).eq('source_id', source_id);
    if (sentError) console.error('[resend-notifications] Could not mark notification sent:', sentError.message);
    return json({ ok: true }, 200, origin);
  } catch (error) {
    console.error('[resend-notifications]', error);
    return json({ error: 'Email notification could not be delivered' }, 500, origin);
  }
});
