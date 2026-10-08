import { supabase, configured } from './supabase.js';
import * as D from './data.js';

/* Every public read goes through here. With Supabase configured the database is the source of truth
   (falling back to sample content only if a query errors). Without Supabase the site runs on sample content. */
async function run(fn, fallback) {
  if (!configured) return fallback;
  try { const { data, error } = await fn(supabase); if (error) throw error; return data; }
  catch (e) { console.warn('[courssins] Supabase query failed, using sample content:', e.message || e); return fallback; }
}
const tutorBySlug = Object.fromEntries(D.tutors.map((t) => [t.slug, t]));
const sampleCourse = (c) => ({ ...c, tutor: tutorBySlug[c.tutor_slug] || null });

export const getSetting = async (key) => {
  const rows = await run((s) => s.from('settings').select('value').eq('key', key).maybeSingle(), null);
  return (rows && rows.value && Object.keys(rows.value).length ? rows.value : null) ?? D.settings[key];
};
export const getSettings = async () => {
  const rows = await run((s) => s.from('settings').select('key,value'), null);
  const out = { ...D.settings };
  (rows || []).forEach((r) => { if (r.value && (Array.isArray(r.value) ? r.value.length : Object.keys(r.value).length)) out[r.key] = r.value; });
  return out;
};
const TUTOR_SEL = 'id,slug,full_name,image_url,specialization';
async function withTutors(s, courses) {
  if (!courses.length) return courses;
  const { data, error } = await s.from('course_tutors').select(`course_id,tutor:tutors(${TUTOR_SEL})`).in('course_id', courses.map((c) => c.id));
  if (error) throw error;
  const byCourse = new Map();
  (data || []).forEach((row) => {
    if (!row.tutor) return;
    const list = byCourse.get(row.course_id) || [];
    list.push(row.tutor);
    byCourse.set(row.course_id, list);
  });
  return courses.map((course) => {
    const tutors = byCourse.get(course.id) || [];
    return { ...course, tutors, tutor: tutors[0] || null };
  });
}
export const getCourses = () => run(async (s) => {
  const { data, error } = await s.from('courses').select('*').eq('published', true).order('sort_order');
  if (error) throw error;
  return { data: await withTutors(s, data || []), error: null };
}, D.courses.map(sampleCourse));
export async function getCourse(slug) {
  const c = await run(async (s) => {
    const { data, error } = await s.from('courses').select('*, modules:course_modules(*)').eq('slug', slug).eq('published', true).maybeSingle();
    if (error) throw error;
    if (!data) return { data: null, error: null };
    return { data: (await withTutors(s, [data]))[0], error: null };
  }, undefined);
  if (c === undefined) { const x = D.courses.find((k) => k.slug === slug); return x ? sampleCourse(x) : null; }
  if (c) c.modules = (c.modules || []).sort((a, b) => a.position - b.position);
  return c;
}
export const getTutors = () => run((s) => s.from('tutors').select('*').eq('published', true).order('sort_order'), D.tutors);
export async function getTutor(slug) {
  const t = await run((s) => s.from('tutors').select('*').eq('slug', slug).eq('published', true).maybeSingle(), undefined);
  return t === undefined ? D.tutors.find((x) => x.slug === slug) || null : t;
}
export const getPosts = (limit) => run((s) => { let q = s.from('blog_posts').select('id,slug,title,excerpt,category,author,image_url,published_at').eq('published', true).lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }); if (limit) q = q.limit(limit); return q; },
  [...D.posts].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, limit || 99));
export async function getPost(slug) {
  const p = await run((s) => s.from('blog_posts').select('*').eq('slug', slug).eq('published', true).maybeSingle(), undefined);
  return p === undefined ? D.posts.find((x) => x.slug === slug) || null : p;
}
export const getLibrary = () => run((s) => s.from('library').select('*').eq('published', true).order('created_at', { ascending: false }), D.library);
export async function getPage(slug) {
  const p = await run((s) => s.from('pages').select('*').eq('slug', slug).eq('published', true).maybeSingle(), undefined);
  return p === undefined ? D.pages.find((x) => x.slug === slug) || null : p;
}
export const getReviews = (courseId) => configured && courseId ? run((s) => s.from('course_reviews').select('name,rating,comment,created_at').eq('course_id', courseId).eq('approved', true).order('created_at', { ascending: false }), []) : Promise.resolve([]);
export const getTestimonials = () => configured ? run((s) => s.from('testimonials').select('id,name,quote,programme,image_url').eq('published', true).order('sort_order').limit(6), []) : Promise.resolve([]);

export async function subscribe(email) {
  if (!configured) return { ok: false, offline: true };
  const id = crypto.randomUUID();
  const { error } = await supabase.from('newsletter_subscribers').insert({ id, email: email.trim().toLowerCase() });
  if (error && error.code !== '23505') return { ok: false, message: 'Could not subscribe right now. Please try again.' };
  return { ok: true, existing: error?.code === '23505', id: error ? null : id };
}