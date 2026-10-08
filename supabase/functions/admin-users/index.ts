import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const siteUrl = Deno.env.get('SITE_URL') ?? 'https://courssin.com.ng';
const allowedOrigins = new Set([new URL(siteUrl).origin, 'http://localhost:8000', 'http://127.0.0.1:8000']);
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
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? siteUrl;
  if (!allowedOrigins.has(origin)) return json({ error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' } });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration is incomplete' }, 500, origin);

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: 'Sign in as a Super Admin to continue' }, 401, origin);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    if (actorError) throw actorError;
    if (actor?.role !== 'super_admin' || !actor.is_active) return json({ error: 'Only an active Super Admin can manage accounts' }, 403, origin);

    const payload = await req.json();
    if (payload.action === 'invite') {
      const email = String(payload.email ?? '').trim().toLowerCase();
      const fullName = String(payload.full_name ?? '').trim();
      const role = payload.role;
      if (!emailPattern.test(email)) return json({ error: 'Enter a valid email address' }, 400, origin);
      if (fullName.length < 3 || fullName.length > 120) return json({ error: 'Enter a name between 3 and 120 characters' }, 400, origin);
      if (!['tutor', 'admin'].includes(role)) return json({ error: 'Invitations may create tutor or admin accounts only' }, 400, origin);

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: `${siteUrl}/login.html`,
      });
      if (error || !data.user) return json({ error: error?.message ?? 'Could not create invitation' }, 400, origin);

      const { error: profileError } = await admin.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
        is_active: true,
      }, { onConflict: 'id' });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        throw profileError;
      }
      if (role === 'tutor') {
        const slugBase = fullName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tutor';
        const { error: tutorError } = await admin.from('tutors').insert({
          user_id: data.user.id,
          slug: `${slugBase}-${data.user.id.slice(0, 8)}`,
          full_name: fullName,
          email,
          published: false,
        });
        if (tutorError) {
          await admin.auth.admin.deleteUser(data.user.id);
          throw tutorError;
        }
      }
      return json({ ok: true, message: `Invitation sent to ${email}` }, 200, origin);
    }

    if (payload.action === 'reset_password') {
      const userId = String(payload.user_id ?? '');
      const { data: target, error } = await admin.from('profiles').select('id,email,role,is_active').eq('id', userId).maybeSingle();
      if (error) throw error;
      if (!target || !['tutor', 'admin'].includes(target.role) || !target.email) return json({ error: 'Tutor or admin account not found' }, 404, origin);
      const { error: resetError } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo: `${siteUrl}/login.html` });
      if (resetError) throw resetError;
      return json({ ok: true, message: `Password reset email sent to ${target.email}` }, 200, origin);
    }

    if (payload.action === 'set_active') {
      const userId = String(payload.user_id ?? '');
      const isActive = payload.is_active === true;
      if (!userId || userId === user.id) return json({ error: 'You cannot change your own account status' }, 400, origin);
      const { data: target, error: targetError } = await admin.from('profiles').select('id,role,is_active').eq('id', userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target || !['tutor', 'admin'].includes(target.role)) return json({ error: 'Tutor or admin account not found' }, 404, origin);

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, { ban_duration: isActive ? 'none' : '876000h' });
      if (authUpdateError) throw authUpdateError;
      const { error: profileUpdateError } = await admin.from('profiles').update({ is_active: isActive }).eq('id', userId);
      if (profileUpdateError) {
        await admin.auth.admin.updateUserById(userId, { ban_duration: target.is_active ? 'none' : '876000h' });
        throw profileUpdateError;
      }
      if (!isActive && target.role === 'tutor') {
        const { error: tutorProfileError } = await admin.from('tutors').update({ published: false }).eq('user_id', userId);
        if (tutorProfileError) {
          await admin.from('profiles').update({ is_active: target.is_active }).eq('id', userId);
          await admin.auth.admin.updateUserById(userId, { ban_duration: target.is_active ? 'none' : '876000h' });
          throw tutorProfileError;
        }
      }
      return json({ ok: true, message: isActive ? 'Account reactivated' : 'Account disabled' }, 200, origin);
    }

    if (payload.action === 'delete_account') {
      const userId = String(payload.user_id ?? '');
      const confirmEmail = String(payload.confirm_email ?? '').trim().toLowerCase();
      if (!userId || userId === user.id) return json({ error: 'You cannot delete your own account' }, 400, origin);
      const { data: target, error } = await admin.from('profiles').select('id,email,role').eq('id', userId).maybeSingle();
      if (error) throw error;
      if (!target || !['tutor', 'admin'].includes(target.role) || !target.email) return json({ error: 'Tutor or admin account not found' }, 404, origin);
      if (confirmEmail !== target.email.trim().toLowerCase()) return json({ error: 'The confirmation email does not match this account' }, 400, origin);
      const { data: tutorProfile } = target.role === 'tutor'
        ? await admin.from('tutors').select('published').eq('user_id', userId).maybeSingle()
        : { data: null };
      if (target.role === 'tutor') {
        const { error: unpublishError } = await admin.from('tutors').update({ published: false }).eq('user_id', userId);
        if (unpublishError) throw unpublishError;
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        if (tutorProfile) await admin.from('tutors').update({ published: tutorProfile.published }).eq('user_id', userId);
        throw deleteError;
      }
      return json({ ok: true, message: 'Account permanently deleted' }, 200, origin);
    }

    return json({ error: 'Unknown account action' }, 400, origin);
  } catch (error) {
    console.error('[admin-users]', error);
    return json({ error: 'The account action could not be completed. Check the function logs.' }, 500, origin);
  }
});
