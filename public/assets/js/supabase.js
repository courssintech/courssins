import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { CONFIG } from './config.js';

export const configured = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const REMEMBER = 'courssins-remember';
export const setRemember = (v) => localStorage.setItem(REMEMBER, v ? '1' : '0');
const remember = () => localStorage.getItem(REMEMBER) !== '0';
// "Remember session" off = session lives only in this tab (sessionStorage).
const storage = {
  getItem: (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
  setItem: (k, v) => { if (remember()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); } else { sessionStorage.setItem(k, v); localStorage.removeItem(k); } },
  removeItem: (k) => { sessionStorage.removeItem(k); localStorage.removeItem(k); },
};

export const supabase = configured
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage } })
  : null;

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
let profilePromise = null;
export function getProfile(force = false) {
  if (!supabase) return Promise.resolve(null);
  if (!profilePromise || force) {
    profilePromise = (async () => {
      const s = await getSession();
      if (!s) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
      return data ? { ...data, email: data.email || s.user.email } : { id: s.user.id, email: s.user.email, role: 'student', full_name: '' };
    })();
  }
  return profilePromise;
}
export const isStaff = (role) => ['tutor', 'admin', 'super_admin'].includes(role);
export const homeFor = (role) => (isStaff(role) ? 'admin.html' : 'dashboard.html');
// Only allow same-site relative redirects such as "course.html?id=x".
export const safeNext = (n) => (n && /^[a-z0-9][a-z0-9\-_./?=&%]*$/i.test(n) && !n.includes('//') && !n.includes(':') ? n : null);

/** Redirects to login if there is no session, or away if the role is not allowed. Returns the profile. */
export async function requireAuth(roles) {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) { location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search)); return new Promise(() => {}); }
  const p = await getProfile();
  if (roles && !roles.includes(p.role)) { location.replace(homeFor(p.role)); return new Promise(() => {}); }
  return p;
}
export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  profilePromise = null;
  location.href = 'index.html';
}
