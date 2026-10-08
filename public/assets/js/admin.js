import { supabase, configured, requireAuth, signOut } from './supabase.js';
import { getSettings } from './api.js';
import { esc, money, fmtDate, icon, modal, toast, setBusy, empty, slugify, sanitizeHTML, sanitizeCSS, arr } from './ui.js';

const $ = (id) => document.getElementById(id);
const ICONS = ['design', 'code', 'server', 'stack', 'ux', 'assist', 'pm', 'data', 'shield', 'heart', 'care'];
const T = 'tutor', A = 'admin', SU = 'super';   // minimum role that may see an entity (RLS still enforces everything server-side)
const boolCol = (v) => (v ? 'Yes' : 'No');

/* Each entity drives a list screen and an add/edit form. Field types: text textarea number select ref check lines json datetime image file */
const E = {
  students: { g: 'People', min: T, t: 'Students', table: 'profiles', ic: 'users', filter: (q) => q.eq('role', 'student'), order: ['created_at', false], create: false, edit: false, del: false,
    cols: [['full_name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['country', 'Country'], ['interest', 'Interest'], ['created_at', 'Joined']],
    fields: [{ k: 'full_name', l: 'Full name', req: 1 }, { k: 'phone', l: 'Phone' }, { k: 'country', l: 'Country' }, { k: 'interest', l: 'Programme of interest' }] },
  users: { g: 'People', min: SU, t: 'Users', table: 'profiles', ic: 'users', order: ['created_at', false], create: false, del: false,
    cols: [['full_name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['is_active', 'Active'], ['created_at', 'Joined']],
    fields: [{ k: 'full_name', l: 'Full name', ro: 1 }, { k: 'email', l: 'Email', ro: 1 }, { k: 'role', l: 'Role', type: 'select', opts: ['student', 'tutor', 'admin', 'super_admin'], req: 1, help: 'Tutors can manage content for courses assigned to them. Admins manage most content. Super admins also manage pages, settings and roles.' }] },
  tutors: { g: 'People', min: A, t: 'Tutors', table: 'tutors', ic: 'user', order: ['sort_order', true], slugFrom: 'full_name',
    cols: [['full_name', 'Name'], ['specialization', 'Specialisation'], ['published', 'Published', boolCol]],
    fields: [{ k: 'full_name', l: 'Full name', req: 1 }, { k: 'slug', l: 'URL slug', help: 'Auto-generated from the name if left empty.' }, { k: 'title', l: 'Professional title' }, { k: 'specialization', l: 'Specialisation' }, { k: 'bio', l: 'Biography', type: 'textarea' }, { k: 'experience', l: 'Experience', type: 'textarea' },
      { k: 'qualifications', l: 'Qualifications (one per line)', type: 'lines' }, { k: 'expertise', l: 'Areas of expertise (one per line)', type: 'lines' }, { k: 'socials', l: 'Social links (JSON)', type: 'json', help: 'Example: {"linkedin":"https://...","x":"https://..."}' }, { k: 'email', l: 'Public contact email' },
      { k: 'image_url', l: 'Photograph', type: 'image' }, { k: 'user_id', l: 'Linked login account (lets the tutor manage their own course content)', type: 'ref', ref: ['profiles', 'full_name'], opt: 1 }, { k: 'published', l: 'Published', type: 'check', def: true }, { k: 'sort_order', l: 'Display order', type: 'number', def: 0 }] },
  courses: { g: 'Learning', min: A, t: 'Courses', table: 'courses', ic: 'book', order: ['sort_order', true], slugFrom: 'title',
    cols: [['title', 'Title'], ['category', 'Category'], ['duration', 'Duration'], ['price', 'Price', (v, r) => money(v, r.currency)], ['tutor_ids', 'Tutors'], ['published', 'Published', boolCol]],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'slug', l: 'URL slug' }, { k: 'category', l: 'Category' }, { k: 'icon', l: 'Icon', type: 'select', opts: ICONS }, { k: 'short_description', l: 'Short description', type: 'textarea' }, { k: 'description', l: 'Full description', type: 'textarea' }, { k: 'duration', l: 'Duration (e.g. 8 weeks)' }, { k: 'price', l: 'Price', type: 'number', def: 0, req: 1, help: 'Use 0 for a free course (unlocks immediately).' }, { k: 'currency', l: 'Currency', def: 'NGN' },
      { k: 'tutor_ids', l: 'Assigned tutors', type: 'refs', ref: ['tutors', 'full_name'], help: 'Select every tutor assigned to this course.' }, { k: 'image_url', l: 'Course image', type: 'image' }, { k: 'outcomes', l: 'Learning outcomes (one per line)', type: 'lines' }, { k: 'requirements', l: 'Requirements (one per line)', type: 'lines' }, { k: 'faqs', l: 'FAQs (JSON)', type: 'json', help: 'Example: [{"q":"Question?","a":"Answer."}]' },
      { k: 'assessment_info', l: 'Assessment information', type: 'textarea' }, { k: 'certificate_info', l: 'Certificate information', type: 'textarea' }, { k: 'featured', l: 'Show on homepage', type: 'check' }, { k: 'published', l: 'Published', type: 'check', def: true }, { k: 'sort_order', l: 'Display order', type: 'number', def: 0 }] },
  modules: { g: 'Learning', min: T, t: 'Course modules', table: 'course_modules', ic: 'stack', order: ['position', true],
    cols: [['course_id', 'Course'], ['position', '#'], ['title', 'Title']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'summary', l: 'Summary', type: 'textarea' }, { k: 'topics', l: 'Topics (one per line)', type: 'lines' }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  lessons: { g: 'Learning', min: T, t: 'Lessons', table: 'lessons', ic: 'play', order: ['position', true],
    cols: [['title', 'Title'], ['course_id', 'Course'], ['is_preview', 'Free preview', boolCol], ['position', '#']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'module_id', l: 'Module', type: 'ref', ref: ['course_modules', 'title'], opt: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'content', l: 'Lesson notes', type: 'textarea' }, { k: 'video_url', l: 'Video link (https)' }, { k: 'duration_min', l: 'Duration (minutes)', type: 'number' }, { k: 'is_preview', l: 'Free preview (visible without enrolling)', type: 'check' }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  resources: { g: 'Learning', min: T, t: 'Course resources', table: 'course_resources', ic: 'file', order: ['created_at', false],
    cols: [['title', 'Title'], ['course_id', 'Course'], ['resource_type', 'Type'], ['published', 'Published', boolCol]],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'resource_type', l: 'Resource type', type: 'select', opts: ['video', 'pdf', 'note', 'assignment'], req: 1 }, { k: 'description', l: 'Description or instructions', type: 'textarea' }, { k: 'object_path', l: 'Private uploaded file', type: 'privateFile' }, { k: 'external_url', l: 'External video or file URL' }, { k: 'published', l: 'Visible to enrolled students', type: 'check', def: true }] },
  assignments: { g: 'Learning', min: T, t: 'Assignments', table: 'assignments', ic: 'file', order: ['position', true],
    cols: [['title', 'Title'], ['course_id', 'Course'], ['max_score', 'Max score']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'module_id', l: 'Module', type: 'ref', ref: ['course_modules', 'title'], opt: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'instructions', l: 'Instructions', type: 'textarea' }, { k: 'max_score', l: 'Maximum score', type: 'number', def: 100 }, { k: 'due_days', l: 'Days allowed (optional)', type: 'number' }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  reviews: { g: 'Content', min: A, t: 'Course reviews', table: 'course_reviews', ic: 'star', order: ['created_at', false],
    cols: [['name', 'Student'], ['course_id', 'Course'], ['rating', 'Rating'], ['approved', 'Homepage approved', boolCol], ['created_at', 'Date']],
    fields: [{ k: 'name', l: 'Student name', ro: 1 }, { k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], ro: 1 }, { k: 'rating', l: 'Rating', type: 'number', ro: 1 }, { k: 'comment', l: 'Review', type: 'textarea', ro: 1 }, { k: 'approved', l: 'Approved for public display', type: 'check' }] },
  testimonials: { g: 'Content', min: A, t: 'Testimonials', table: 'testimonials', ic: 'chat', order: ['sort_order', true], slugFrom: 'name',
    cols: [['name', 'Name'], ['programme', 'Programme'], ['published', 'Published', boolCol], ['sort_order', 'Order']],
    fields: [{ k: 'name', l: 'Name', req: 1 }, { k: 'quote', l: 'Testimonial', type: 'textarea', req: 1 }, { k: 'programme', l: 'Programme or course' }, { k: 'image_url', l: 'Photo', type: 'image' }, { k: 'published', l: 'Published', type: 'check', def: true }, { k: 'sort_order', l: 'Display order', type: 'number', def: 0 }] },
  submissions: { g: 'Learning', min: T, t: 'Submissions', table: 'assignment_submissions', ic: 'edit', order: ['submitted_at', false], create: false, editLabel: 'Grade',
    cols: [['assignment_id', 'Assignment'], ['user_id', 'Student'], ['status', 'Status'], ['score', 'Score'], ['submitted_at', 'Submitted']],
    before: (v) => ({ ...v, status: v.score !== null ? 'graded' : 'submitted', graded_at: v.score !== null ? new Date().toISOString() : null }),
    fields: [{ k: 'assignment_id', l: 'Assignment', type: 'ref', ref: ['assignments', 'title'], ro: 1 }, { k: 'user_id', l: 'Student', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }, { k: 'content', l: 'Answer', type: 'textarea', ro: 1 }, { k: 'link_url', l: 'Link', ro: 1 }, { k: 'score', l: 'Score', type: 'number' }, { k: 'feedback', l: 'Feedback', type: 'textarea' }] },
  exams: { g: 'Learning', min: T, t: 'Examinations', table: 'exams', ic: 'quiz',
    cols: [['title', 'Title'], ['course_id', 'Course'], ['pass_mark', 'Pass mark'], ['published', 'Published', boolCol]],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'instructions', l: 'Instructions', type: 'textarea' }, { k: 'duration_min', l: 'Duration (minutes)', type: 'number', def: 30 }, { k: 'pass_mark', l: 'Pass mark (%)', type: 'number', def: 50 }, { k: 'published', l: 'Published', type: 'check', def: true }] },
  questions: { g: 'Learning', min: T, t: 'Exam questions', table: 'exam_questions', ic: 'list', order: ['position', true],
    cols: [['exam_id', 'Exam'], ['position', '#'], ['question', 'Question']],
    fields: [{ k: 'exam_id', l: 'Exam', type: 'ref', ref: ['exams', 'title'], req: 1 }, { k: 'question', l: 'Question', type: 'textarea', req: 1 }, { k: 'options', l: 'Answer options (one per line)', type: 'lines', req: 1 }, { k: 'correct_index', l: 'Correct option number', type: 'number', def: 0, req: 1, help: 'Count from 1: 1 = the first option listed.', off: 1 }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  results: { g: 'Learning', min: T, t: 'Exam results', table: 'exam_results', ic: 'chart', order: ['taken_at', false], create: false, edit: false,
    cols: [['exam_id', 'Exam'], ['user_id', 'Student'], ['score', 'Score %'], ['passed', 'Passed', boolCol], ['taken_at', 'Taken']], fields: [{ k: 'exam_id', l: 'Exam', type: 'ref', ref: ['exams', 'title'], ro: 1 }, { k: 'user_id', l: 'Student', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }] },
  enrollments: { g: 'Learning', min: A, t: 'Enrolments', table: 'enrollments', ic: 'users', order: ['enrolled_at', false],
    before: (v) => ({ ...v, activated_at: v.status === 'active' ? new Date().toISOString() : null }),
    cols: [['user_id', 'Student'], ['course_id', 'Course'], ['status', 'Status'], ['enrolled_at', 'Enrolled']],
    fields: [{ k: 'user_id', l: 'Student', type: 'ref', ref: ['profiles', 'full_name'], req: 1, lockEdit: 1 }, { k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1, lockEdit: 1 }, { k: 'status', l: 'Status', type: 'select', opts: ['pending', 'active', 'cancelled'], def: 'pending', help: 'Normally set to active automatically after verified payment. Set it by hand only for scholarships or confirmed offline payments.' }] },
  payments: { g: 'Money', min: A, t: 'Payments', table: 'payments', ic: 'card', order: ['created_at', false], create: false, del: false,
    confirmSave: (v) => (v.status === 'success' ? 'Marking this payment successful unlocks the course for the student. Continue only if you have confirmed the money was received.' : ''),
    cols: [['created_at', 'Date'], ['user_id', 'Student'], ['course_id', 'Course'], ['amount', 'Amount', (v, r) => money(v, r.currency)], ['reference', 'Reference'], ['status', 'Status']],
    fields: [{ k: 'reference', l: 'Reference', ro: 1 }, { k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], ro: 1 }, { k: 'user_id', l: 'Student', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }, { k: 'amount', l: 'Amount', type: 'number', ro: 1 }, { k: 'provider', l: 'Provider', ro: 1 }, { k: 'status', l: 'Status', type: 'select', opts: ['pending', 'success', 'failed', 'refunded'], req: 1 }] },
  certificates: { g: 'Learning', min: A, t: 'Certificates', table: 'certificates', ic: 'award', order: ['issued_at', false],
    before: (v) => ({ ...v, certificate_number: v.certificate_number || `CTI-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }),
    cols: [['certificate_number', 'Number'], ['student_name', 'Student'], ['course_title', 'Course'], ['status', 'Status'], ['issued_at', 'Issued']],
    fields: [{ k: 'user_id', l: 'Student account', type: 'ref', ref: ['profiles', 'full_name'], req: 1, lockEdit: 1 }, { k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1, lockEdit: 1 }, { k: 'student_name', l: 'Name on certificate', req: 1 }, { k: 'course_title', l: 'Course title on certificate', req: 1 }, { k: 'certificate_number', l: 'Certificate number', help: 'Generated automatically if left empty.' }, { k: 'status', l: 'Status', type: 'select', opts: ['valid', 'revoked'], def: 'valid' }] },
  events: { g: 'Content', min: A, t: 'Events', table: 'events', ic: 'calendar', order: ['starts_at', false],
    cols: [['title', 'Title'], ['starts_at', 'Starts'], ['location', 'Location'], ['published', 'Published', boolCol]],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'description', l: 'Description', type: 'textarea' }, { k: 'starts_at', l: 'Starts', type: 'datetime' }, { k: 'location', l: 'Location' }, { k: 'url', l: 'Link' }, { k: 'image_url', l: 'Image', type: 'image' }, { k: 'published', l: 'Published', type: 'check', def: true }] },
  library: { g: 'Content', min: A, t: 'Library', table: 'library', ic: 'stack', order: ['created_at', false],
    cols: [['title', 'Title'], ['type', 'Type'], ['access', 'Access'], ['published', 'Published', boolCol]],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'type', l: 'Type', type: 'select', opts: ['book', 'pdf', 'material', 'video', 'document'], def: 'material' }, { k: 'description', l: 'Description', type: 'textarea' }, { k: 'url', l: 'File or link', type: 'file', req: 1, help: 'Paste a link or upload a PDF, document or video (max 25 MB).' }, { k: 'cover_url', l: 'Cover image', type: 'image' }, { k: 'course_id', l: 'Related course', type: 'ref', ref: ['courses', 'title'], opt: 1 }, { k: 'access', l: 'Who can open it', type: 'select', opts: ['public', 'members'], def: 'public' }, { k: 'published', l: 'Published', type: 'check', def: true }] },
  blog: { g: 'Content', min: A, t: 'Blog posts', table: 'blog_posts', ic: 'edit', order: ['published_at', false], slugFrom: 'title', preview: { html: 'content' },
    cols: [['title', 'Title'], ['category', 'Category'], ['author', 'Author'], ['published', 'Published', boolCol], ['published_at', 'Date']],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'slug', l: 'URL slug' }, { k: 'excerpt', l: 'Short description', type: 'textarea' }, { k: 'content', l: 'Article body (HTML: p, h2, ul, img, a)', type: 'textarea', tall: 1 }, { k: 'category', l: 'Category' }, { k: 'author', l: 'Author' }, { k: 'image_url', l: 'Article image', type: 'image' }, { k: 'published_at', l: 'Publication date', type: 'datetime' }, { k: 'published', l: 'Published (untick to unpublish)', type: 'check' }] },
  pages: { g: 'Content', min: SU, t: 'Pages', table: 'pages', ic: 'file', order: ['updated_at', false], slugFrom: 'title', preview: { html: 'html', css: 'css' },
    before: (v) => ({ ...v, updated_at: new Date().toISOString() }),
    cols: [['title', 'Title'], ['slug', 'Slug'], ['published', 'Published', boolCol], ['updated_at', 'Updated']],
    fields: [{ k: 'title', l: 'Page title', req: 1 }, { k: 'slug', l: 'Page slug (lowercase, hyphens)', req: 1, help: 'The page will live at page.html?slug=your-slug' }, { k: 'html', l: 'HTML content', type: 'textarea', tall: 1, help: 'Scripts, iframes, forms and inline event handlers are removed automatically. The Courssins header and footer are added around your page.' }, { k: 'css', l: 'Custom CSS (applies to this page only)', type: 'textarea' }, { k: 'image_url', l: 'Page image', type: 'image' }, { k: 'meta_title', l: 'Meta title' }, { k: 'meta_description', l: 'Meta description' }, { k: 'published', l: 'Published', type: 'check' }] },
  subscribers: { g: 'Content', min: A, t: 'Newsletter', table: 'newsletter_subscribers', ic: 'mail', order: ['created_at', false], create: false, edit: false, cols: [['email', 'Email'], ['created_at', 'Subscribed']], fields: [] },
  messages: { g: 'Content', min: A, t: 'Messages', table: 'contact_messages', ic: 'chat', order: ['created_at', false], create: false, readonly: 1,
    cols: [['name', 'Name'], ['email', 'Email'], ['subject', 'Subject'], ['created_at', 'Received']],
    fields: [{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'subject', l: 'Subject' }, { k: 'message', l: 'Message', type: 'textarea', tall: 1 }] },
  notifications: { g: 'Content', min: A, t: 'Notifications', table: 'notifications', ic: 'bell', order: ['created_at', false],
    cols: [['user_id', 'Student'], ['title', 'Title'], ['read', 'Read', boolCol], ['created_at', 'Sent']],
    fields: [{ k: 'user_id', l: 'Send to', type: 'ref', ref: ['profiles', 'full_name'], req: 1, lockEdit: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'body', l: 'Message', type: 'textarea' }, { k: 'link', l: 'Link (e.g. dashboard.html#courses)' }] },
};
const SITE_SPEC = [
  { key: 'hero', title: 'Homepage hero', fields: [['label', 'Announcement label'], ['title', 'Headline'], ['text', 'Supporting paragraph', 'textarea'], ['primary_text', 'Primary button text'], ['secondary_text', 'Secondary button text']] },
  { key: 'stats', title: 'Statistics (four numbers)', rows: ['value', 'suffix', 'label'] },
  { key: 'talent', title: 'Talent Transformation section', json: 'cards', fields: [['title', 'Title'], ['text', 'Paragraph', 'textarea']] },
  { key: 'why', title: 'Why choose Courssins section', json: 'cards', fields: [['title', 'Title'], ['text', 'Paragraph', 'textarea']] },
  { key: 'membership', title: 'Membership section', fields: [['title', 'Heading'], ['text', 'Description', 'textarea']] },
  { key: 'site', title: 'Website settings and contact details', fields: [['name', 'Site name'], ['description', 'Footer description', 'textarea'], ['email', 'Contact email'], ['phone', 'Phone'], ['address', 'Address'], ['socials.facebook', 'Facebook URL'], ['socials.instagram', 'Instagram URL'], ['socials.x', 'X URL'], ['socials.linkedin', 'LinkedIn URL']] },
  { key: 'certificate', title: 'Certificate signature', fields: [['organisation', 'Organisation name'], ['signatory', 'Authorised signatory title or name']] },
];

const rank = { tutor: 1, admin: 2, super_admin: 3 };
const need = { [T]: 1, [A]: 2, [SU]: 3 };
if (!configured) {
  $('panel').innerHTML = `<div class="panel"><h2>Connect Supabase to use the admin area</h2><p class="muted">Add your project URL and anon key in <code>assets/js/config.js</code>, then create your Super Admin (see README).</p><a class="btn btn-lime" style="margin-top:16px" href="index.html">Back to website</a></div>`;
} else {
  const me = await requireAuth(['tutor', 'admin', 'super_admin']);
  $('whoami').textContent = `${me.full_name || me.email} · ${me.role.replace('_', ' ')}`;
  const myRank = rank[me.role];
  const allowed = Object.entries(E).filter(([, e]) => myRank >= need[e.min]);
  const groups = [...new Set(allowed.map(([, e]) => e.g))];
  const links = [`<button class="side-link" data-v="dash">${icon('grid', '', 18)}Overview</button>`];
  groups.forEach((g) => { links.push(`<div class="side-label">${g}</div>`); allowed.filter(([, e]) => e.g === g).forEach(([k, e]) => links.push(`<button class="side-link" data-v="${k}">${icon(e.ic, '', 18)}${e.t}</button>`)); });
  if (myRank >= 3) links.push('<div class="side-label">Site</div>', `<button class="side-link" data-v="site">${icon('settings', '', 18)}Website content</button>`);
  $('sideNav').innerHTML = links.join('');
  $('signOutBtn').addEventListener('click', signOut);
  const side = $('sidebar'), scrim = $('scrim'), toggle = (o) => { side.classList.toggle('open', o); scrim.classList.toggle('open', o); };
  $('menuBtn').addEventListener('click', () => toggle(true)); scrim.addEventListener('click', () => toggle(false));

  const refCache = {};
  async function refMap(table, label) {
    const key = `${table}.${label}`; if (refCache[key]) return refCache[key];
    if (table === 'courses' && me.role === 'tutor') {
      const { data: tutorRows } = await supabase.from('tutors').select('id').eq('user_id', me.id);
      const tutorIds = (tutorRows || []).map((tutor) => tutor.id);
      if (!tutorIds.length) return (refCache[key] = {});
      const { data: assignments } = await supabase.from('course_tutors').select('course_id').in('tutor_id', tutorIds);
      const courseIds = [...new Set((assignments || []).map((assignment) => assignment.course_id))];
      if (!courseIds.length) return (refCache[key] = {});
      const { data: courses } = await supabase.from('courses').select(`id,${label}`).in('id', courseIds).limit(1000);
      return (refCache[key] = Object.fromEntries((courses || []).map((course) => [course.id, course[label] || '(unnamed)'])));
    }
    const { data } = await supabase.from(table).select(`id,${label}`).limit(1000);
    return (refCache[key] = Object.fromEntries((data || []).map((r) => [r.id, r[label] || '(unnamed)'])));
  }
  const fmt = (col, row, maps) => {
    const [k, , f] = col; const v = row[k]; const fld = maps.fields[k];
    if (f) return esc(f(v, row));
    if (fld?.type === 'ref') return esc(maps.refs[k]?.[v] || '');
    if (fld?.type === 'refs') return esc((v || []).map((id) => maps.refs[k]?.[id]).filter(Boolean).join(', '));
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return esc(v.join(', '));
    if (/_at$/.test(k)) return fmtDate(v);
    return esc(v);
  };
  const csv = (rows, cols) => { const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`; const b = new Blob([[cols.map((c) => q(c[1])).join(','), ...rows.map((r) => cols.map((c) => q(r[c[0]])).join(','))].join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'export.csv'; a.click(); };

  async function accountAction(action, userId, isActive, email) {
    let body = { action, user_id: userId, is_active: isActive };
    if (action === 'delete_account') {
      if (!confirm(`Permanently delete ${email}? Existing profile-linked learning records may also be removed.`)) return;
      const confirmEmail = prompt(`Type ${email} to confirm permanent deletion.`);
      if (confirmEmail?.trim().toLowerCase() !== email?.trim().toLowerCase()) return toast('The confirmation email did not match.', 'err');
      body.confirm_email = confirmEmail;
    } else {
      const message = action === 'reset_password' ? 'Send a password reset email to this account?' : `${isActive ? 'Reactivate' : 'Disable'} this account?`;
      if (!confirm(message)) return;
    }
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error || data?.error) return toast(data?.error || error?.message || 'Account action failed.', 'err');
    toast(data?.message || 'Account updated', 'ok');
    list('users');
  }

  function inviteAccount() {
    const m = modal({ title: 'Invite account', body: `<form id="inviteUserForm" novalidate>
      <div class="field"><label for="inviteName">Full name</label><input class="input" id="inviteName" autocomplete="name" required></div>
      <div class="field"><label for="inviteEmail">Email</label><input class="input" id="inviteEmail" type="email" autocomplete="email" required></div>
      <div class="field"><label for="inviteRole">Role</label><select class="input" id="inviteRole"><option value="tutor">Tutor</option><option value="admin">Admin</option></select></div>
      <p class="hint">They will receive a secure invitation link to set their password.</p>
      </form>`, actions: '<button class="btn btn-lime" id="sendInvite" type="button">Send invitation</button>' });
    m.el.querySelector('#sendInvite').addEventListener('click', async (event) => {
      const full_name = m.el.querySelector('#inviteName').value.trim();
      const email = m.el.querySelector('#inviteEmail').value.trim();
      const role = m.el.querySelector('#inviteRole').value;
      if (full_name.length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a name and valid email address.', 'err');
      setBusy(event.currentTarget, true, 'Sending invitation');
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'invite', full_name, email, role } });
      setBusy(event.currentTarget, false);
      if (error || data?.error) return toast(data?.error || error?.message || 'Invitation failed.', 'err');
      toast(data?.message || 'Invitation sent', 'ok');
      m.close();
      list('users');
    });
  }

  async function list(key) {
    const e = E[key]; $('panel').innerHTML = '<div class="card skeleton" style="min-height:260px"></div>';
    let q = supabase.from(e.table).select('*').order(e.order[0], { ascending: e.order[1] }).limit(500); if (e.filter) q = e.filter(q);
    const { data, error } = await q;
    if (error) { $('panel').innerHTML = empty('Could not load', error.message); return; }
    if (key === 'courses' && data.length) {
      const { data: assignments, error: assignmentError } = await supabase.from('course_tutors').select('course_id,tutor_id').in('course_id', data.map((course) => course.id));
      if (assignmentError) { $('panel').innerHTML = empty('Could not load tutor assignments', assignmentError.message); return; }
      const byCourse = new Map();
      (assignments || []).forEach(({ course_id, tutor_id }) => byCourse.set(course_id, [...(byCourse.get(course_id) || []), tutor_id]));
      data.forEach((course) => { course.tutor_ids = byCourse.get(course.id) || []; });
    }
    const fields = Object.fromEntries([...e.fields, ...e.cols.map(([k]) => ({ k }))].map((f) => [f.k, f]));
    const refs = {}; await Promise.all(e.fields.filter((f) => ['ref', 'refs'].includes(f.type)).map(async (f) => { refs[f.k] = await refMap(...f.ref); }));
    const maps = { fields, refs };
    const canAdd = e.create !== false, canEdit = e.edit !== false, canDel = e.del !== false && (e.min !== T || true);
    $('panel').innerHTML = `<div class="tools"><div class="search grow" style="margin:0;max-width:340px">${icon('search', '', 18)}<input class="input" id="rowSearch" type="search" placeholder="Search ${e.t.toLowerCase()}" aria-label="Search"></div><span class="grow"></span><button class="btn btn-ghost btn-sm" id="csvBtn">${icon('download', '', 16)}Export CSV</button>${key === 'users' ? `<button class="btn btn-lime btn-sm" id="addBtn">${icon('plus', '', 16)}Invite account</button>` : canAdd ? `<button class="btn btn-lime btn-sm" id="addBtn">${icon('plus', '', 16)}Add new</button>` : ''}</div>
    <div class="table-wrap"><table class="data"><thead><tr>${e.cols.map((c) => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody id="rows"></tbody></table></div><p class="hint" style="margin-top:10px">${data.length} record${data.length === 1 ? '' : 's'}</p>`;
    const body = $('rows');
    const draw = (rows) => { body.innerHTML = rows.map((r) => {
      const accountActions = key === 'users' && ['tutor', 'admin'].includes(r.role) ? `<button class="btn btn-ghost btn-sm" data-account-action="reset_password" data-user-id="${esc(r.id)}" data-user-email="${esc(r.email)}">Reset password</button><button class="btn btn-ghost btn-sm" data-account-action="set_active" data-active="${!r.is_active}" data-user-id="${esc(r.id)}" data-user-email="${esc(r.email)}">${r.is_active ? 'Disable' : 'Reactivate'}</button><button class="btn btn-danger btn-sm" data-account-action="delete_account" data-user-id="${esc(r.id)}" data-user-email="${esc(r.email)}">Delete</button>` : '';
      return `<tr data-id="${r.id}">${e.cols.map((c) => `<td>${fmt(c, r, maps)}</td>`).join('')}<td style="text-align:right;white-space:nowrap">${accountActions} ${canEdit || e.readonly ? `<button class="btn btn-ghost btn-sm" data-edit="${r.id}">${e.readonly ? 'View' : e.editLabel || 'Edit'}</button>` : ''} ${canDel && e.del !== false ? `<button class="btn btn-danger btn-sm" data-del="${r.id}" aria-label="Delete">${icon('trash', '', 16)}</button>` : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="${e.cols.length + 1}"><div style="padding:28px;text-align:center" class="muted">Nothing here yet.</div></td></tr>`; };
    draw(data);
    $('rowSearch').addEventListener('input', (ev) => { const s = ev.target.value.toLowerCase(); draw(data.filter((r) => JSON.stringify(r).toLowerCase().includes(s))); });
    $('csvBtn').addEventListener('click', () => csv(data.map((r) => Object.fromEntries(e.cols.map((c) => [c[0], maps.fields[c[0]]?.type === 'ref' ? refs[c[0]]?.[r[c[0]]] : maps.fields[c[0]]?.type === 'refs' ? (r[c[0]] || []).map((id) => refs[c[0]]?.[id]).filter(Boolean).join(', ') : r[c[0]]]))), e.cols));
    $('addBtn')?.addEventListener('click', () => key === 'users' ? inviteAccount() : form(key, null));
    body.onclick = async (ev) => {
      const ed = ev.target.closest('[data-edit]'), dl = ev.target.closest('[data-del]');
      const action = ev.target.closest('[data-account-action]');
      if (action) return accountAction(action.dataset.accountAction, action.dataset.userId, action.dataset.active === 'true', action.dataset.userEmail);
      if (ed) form(key, data.find((r) => r.id === ed.dataset.edit));
      if (dl && key === 'resources' && confirm('Delete this resource and its private file? This cannot be undone.')) {
        const resource = data.find((item) => item.id === dl.dataset.del);
        const { error: deleteError } = await supabase.from(e.table).delete().eq('id', dl.dataset.del);
        if (deleteError) return toast(deleteError.message, 'err');
        if (resource?.object_path) {
          const { error: storageError } = await supabase.storage.from('course-materials').remove([resource.object_path]);
          if (storageError) { toast('Resource deleted, but private-file cleanup failed.', 'err'); return list(key); }
        }
        toast('Resource deleted', 'ok');
        return list(key);
      }
      if (dl && confirm('Delete this record permanently? This cannot be undone.')) { const { error: er } = await supabase.from(e.table).delete().eq('id', dl.dataset.del); if (er) return toast(er.message, 'err'); toast('Deleted', 'ok'); list(key); }
    };
  }

  const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  async function form(key, row) {
    const e = E[key]; const editing = !!row;
    const refOpts = {}; await Promise.all(e.fields.filter((f) => ['ref', 'refs'].includes(f.type)).map(async (f) => { refOpts[f.k] = await refMap(...f.ref); }));
    const html = e.fields.map((f) => {
      const id = `f_${f.k}`; let v = row ? row[f.k] : f.def; const ro = e.readonly || f.ro || (editing && f.lockEdit);
      const help = f.help ? `<span class="hint">${esc(f.help)}</span>` : ''; const dis = ro ? 'disabled' : '';
      if (f.type === 'refs') {
        const selected = new Set(Array.isArray(v) ? v : []);
        const options = Object.entries(refOpts[f.k]).map(([id, label]) => `<option value="${id}" ${selected.has(id) ? 'selected' : ''}>${esc(label)}</option>`).join('');
        return `<div class="field"><label for="${id}">${esc(f.l)}</label><select class="input" id="${id}" multiple size="${Math.min(8, Math.max(3, Object.keys(refOpts[f.k]).length))}" ${dis}>${options}</select>${help}</div>`;
      }
      if (f.type === 'privateFile') {
        return `<div class="field"><label for="${id}">${esc(f.l)}</label><div style="display:flex;gap:8px"><input class="input" id="${id}" type="text" value="${esc(v ?? '')}" readonly><label class="btn btn-ghost" style="flex:none;height:54px">${icon('upload', '', 18)}Upload<input type="file" hidden data-private-up="${id}" accept="video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"></label></div><span class="hint">Private to enrolled students and assigned tutors. Maximum file size: 50 MB.</span></div>`;
      }
      let ctl;
      if (f.type === 'textarea' || f.type === 'lines' || f.type === 'json') {
        if (f.type === 'lines') v = arr(v).join('\n'); if (f.type === 'json') v = v == null ? '' : JSON.stringify(v, null, 2);
        ctl = `<textarea class="input" id="${id}" ${dis} style="${f.tall ? 'min-height:280px' : ''};${f.type === 'json' ? 'font-family:monospace;font-size:.85rem' : ''}">${esc(v ?? '')}</textarea>`;
      } else if (f.type === 'select') ctl = `<select class="input" id="${id}" ${dis}>${f.opts.map((o) => `<option ${o === (v ?? f.opts[0]) ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      else if (f.type === 'ref') ctl = `<select class="input" id="${id}" ${dis}>${f.opt || !editing ? '<option value="">' + (f.opt ? 'None' : 'Select') + '</option>' : ''}${Object.entries(refOpts[f.k]).map(([i, l]) => `<option value="${i}" ${i === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      else if (f.type === 'check') return `<label class="check" style="margin-bottom:18px"><input type="checkbox" id="${id}" ${v ? 'checked' : ''} ${dis}> ${esc(f.l)}</label>`;
      else if (f.type === 'datetime') ctl = `<input class="input" id="${id}" type="datetime-local" value="${toLocal(v || (f.k === 'published_at' && !editing ? new Date() : ''))}" ${dis}>`;
      else if (f.type === 'number') ctl = `<input class="input" id="${id}" type="number" step="any" value="${v == null ? '' : (f.off ? Number(v) + 1 : v)}" ${dis}>`;
      else if (f.type === 'image' || f.type === 'file') ctl = `<div style="display:flex;gap:8px"><input class="input" id="${id}" type="text" value="${esc(v ?? '')}" placeholder="https://… or upload" ${dis}><label class="btn btn-ghost" style="flex:none;height:54px">${icon('upload', '', 18)}Upload<input type="file" hidden data-up="${id}" accept="${f.type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,video/mp4,video/webm,image/*'}"></label></div>`;
      else ctl = `<input class="input" id="${id}" type="text" value="${esc(v ?? '')}" ${dis}>`;
      return `<div class="field"><label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>${ctl}${help}</div>`;
    }).join('');
    const prev = e.preview ? `<button class="btn btn-ghost" id="prevBtn" type="button">Preview</button>` : '';
    const m = modal({ title: `${editing ? (e.readonly ? 'View' : 'Edit') : 'Add'} ${e.t.toLowerCase().replace(/s$/, '')}`, wide: true, body: `<form id="entForm" novalidate>${html}</form>`, actions: e.readonly ? '' : `${prev}<button class="btn btn-lime" id="saveBtn" type="button">Save</button>` });
    m.el.querySelectorAll('[data-up]').forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return; if (f.size > 25 * 1024 * 1024) return toast('File is larger than 25 MB.', 'err');
      const path = `${key}/${Date.now()}-${f.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      toast('Uploading…'); const { error } = await supabase.storage.from('media').upload(path, f, { upsert: false, contentType: f.type });
      if (error) return toast(`Upload failed: ${error.message}`, 'err');
      m.el.querySelector(`#${inp.dataset.up}`).value = supabase.storage.from('media').getPublicUrl(path).data.publicUrl; toast('Uploaded', 'ok');
    }));
    m.el.querySelectorAll('[data-private-up]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      if (file.size > 50 * 1024 * 1024) return toast('Course resource exceeds the 50 MB limit.', 'err');
      const courseId = m.el.querySelector('#f_course_id')?.value;
      if (!courseId) return toast('Select a course before uploading its resource.', 'err');
      const path = `${courseId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      toast('Uploading private course resource…');
      const { error } = await supabase.storage.from('course-materials').upload(path, file, { upsert: false, contentType: file.type });
      if (error) return toast(`Upload failed: ${error.message}`, 'err');
      m.el.querySelector(`#${input.dataset.privateUp}`).value = path;
      toast('Resource uploaded privately', 'ok');
    }));
    m.el.querySelector('#prevBtn')?.addEventListener('click', () => { const g = (k) => m.el.querySelector(`#f_${k}`)?.value || ''; const pm = modal({ title: 'Preview', wide: true, body: '<div id="pv"></div>' }); pm.el.querySelector('#pv').attachShadow({ mode: 'open' }).innerHTML = `<link rel="stylesheet" href="assets/css/style.css"><style>${sanitizeCSS(g(e.preview.css))}</style><div class="prose" style="max-width:none">${sanitizeHTML(g(e.preview.html))}</div>`; });
    m.el.querySelector('#saveBtn')?.addEventListener('click', async (ev) => {
      let v = {}; const errs = [];
      for (const f of e.fields) {
        if (f.ro || (editing && f.lockEdit)) continue;
        const el = m.el.querySelector(`#f_${f.k}`); let x;
        if (f.type === 'check') x = el.checked;
        else if (f.type === 'refs') x = [...el.selectedOptions].map((option) => option.value);
        else x = el.value.trim();
        if (f.type === 'lines') x = x.split('\n').map((s) => s.trim()).filter(Boolean);
        else if (f.type === 'json') { try { x = x ? JSON.parse(x) : (f.k === 'faqs' ? [] : {}); } catch { errs.push(`${f.l}: not valid JSON`); continue; } }
        else if (f.type === 'number') x = x === '' ? null : Number(x) - (f.off ? 1 : 0);
        else if (f.type === 'datetime') x = x ? new Date(x).toISOString() : null;
        else if (f.type === 'ref' || f.type === 'select' || typeof x === 'string') x = x === '' && (f.opt || f.type !== 'select') ? null : x;
        if (f.req && (x === null || x === '' || (Array.isArray(x) && !x.length))) errs.push(`${f.l} is required`);
        v[f.k] = x;
      }
      if (e.slugFrom && 'slug' in v) v.slug = slugify(v.slug || v[e.slugFrom] || '');
      if (key === 'pages' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug || '')) errs.push('Slug may only contain lowercase letters, numbers and hyphens');
      if (key === 'resources') {
        const validExternal = !v.external_url || /^https?:\/\/[^\s]+$/i.test(v.external_url);
        if (!v.object_path && !v.external_url) errs.push('Upload a file or enter an external HTTP(S) URL');
        else if (!validExternal) errs.push('Resource URL must start with https:// or http://');
      }
      if (key === 'certificates') { /* names required above */ }
      if (errs.length) return toast(errs[0], 'err');
      const tutorIds = key === 'courses' ? [...new Set(v.tutor_ids || [])] : null;
      if (key === 'courses') { delete v.tutor_ids; v.tutor_id = tutorIds[0] || null; }
      if (e.before) v = e.before(v);
      const c = e.confirmSave?.(v); if (c && !confirm(c)) return;
      setBusy(ev.currentTarget, true, 'Saving');
      const r = editing ? await supabase.from(e.table).update(v).eq('id', row.id) : await supabase.from(e.table).insert(v).select('id').single();
      if (r.error) { setBusy(ev.currentTarget, false); return toast(r.error.code === '23505' ? 'That slug or value already exists.' : r.error.message, 'err'); }
      if (key === 'courses') {
        const courseId = editing ? row.id : r.data?.id;
        const { data: current, error: lookupError } = await supabase.from('course_tutors').select('tutor_id').eq('course_id', courseId);
        if (lookupError) { setBusy(ev.currentTarget, false); toast(`Course saved; tutor assignments were not changed: ${lookupError.message}`, 'err'); m.close(); list(key); return; }
        const existing = (current || []).map((link) => link.tutor_id);
        const additions = tutorIds.filter((id) => !existing.includes(id)).map((tutor_id) => ({ course_id: courseId, tutor_id }));
        if (additions.length) {
          const { error: addError } = await supabase.from('course_tutors').insert(additions);
          if (addError) { setBusy(ev.currentTarget, false); toast(`Course saved; tutor assignments were not changed: ${addError.message}`, 'err'); m.close(); list(key); return; }
        }
        const removals = existing.filter((id) => !tutorIds.includes(id));
        if (removals.length) {
          const { error: removeError } = await supabase.from('course_tutors').delete().eq('course_id', courseId).in('tutor_id', removals);
          if (removeError) { setBusy(ev.currentTarget, false); toast(`Course saved; some former tutor assignments remain: ${removeError.message}`, 'err'); m.close(); list(key); return; }
        }
      }
      toast('Saved', 'ok'); m.close(); Object.keys(refCache).forEach((k) => delete refCache[k]); list(key);
    });
  }

  async function dash() {
    const c = (t, f) => { let q = supabase.from(t).select('id', { count: 'exact', head: true }); if (f) q = f(q); return q.then((r) => r.count ?? 0); };
    const [st, co, en, pend, sub, msg] = await Promise.all([c('profiles', (q) => q.eq('role', 'student')), c('courses'), c('enrollments', (q) => q.eq('status', 'active')), c('payments', (q) => q.eq('status', 'pending')), c('newsletter_subscribers'), c('contact_messages')]);
    const { data: paid } = await supabase.from('payments').select('amount').eq('status', 'success');
    const tot = (paid || []).reduce((n, p) => n + Number(p.amount), 0);
    $('panel').innerHTML = `<div class="kpis"><div class="kpi lime"><b>${st}</b><span>Students</span></div><div class="kpi"><b>${co}</b><span>Courses</span></div><div class="kpi"><b>${en}</b><span>Active enrolments</span></div><div class="kpi"><b>${pend}</b><span>Pending payments</span></div></div>
    <div class="kpis"><div class="kpi"><b>${money(tot)}</b><span>Verified payments</span></div><div class="kpi"><b>${sub}</b><span>Newsletter subscribers</span></div><div class="kpi"><b>${msg}</b><span>Contact messages</span></div></div>
    <div class="panel"><h2>Quick actions</h2><div class="btn-row">${allowed.some(([k]) => k === 'courses') ? '<button class="btn btn-dark" data-v="courses">Manage courses</button>' : ''}${allowed.some(([k]) => k === 'blog') ? '<button class="btn btn-dark" data-v="blog">Write an article</button>' : ''}${allowed.some(([k]) => k === 'payments') ? '<button class="btn btn-dark" data-v="payments">Review payments</button>' : ''}${allowed.some(([k]) => k === 'lessons') ? '<button class="btn btn-dark" data-v="lessons">Add lessons</button>' : ''}</div></div>`;
  }

  const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o) ?? '';
  const put = (o, p, v) => { const ks = p.split('.'); ks.slice(0, -1).reduce((a, k) => (a[k] ||= {}), o)[ks.at(-1)] = v; };
  async function site() {
    const S = await getSettings();
    $('panel').innerHTML = `<p class="muted" style="margin-bottom:16px;max-width:70ch">Edit what visitors see on the homepage, footer and certificates. Changes are live as soon as you save.</p>` + SITE_SPEC.map((sec) => {
      const cur = S[sec.key] || {};
      let inner = '';
      if (sec.rows) inner = `<div class="table-wrap"><table class="data"><thead><tr><th>Number</th><th>Suffix</th><th>Label</th></tr></thead><tbody>${[0, 1, 2, 3].map((i) => `<tr>${sec.rows.map((k) => `<td><input class="input" style="height:44px" data-k="${i}.${k}" value="${esc(cur[i]?.[k] ?? '')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      else inner = sec.fields.map(([k, l, t]) => `<div class="field"><label>${l}</label>${t === 'textarea' ? `<textarea class="input" data-k="${k}">${esc(get(cur, k))}</textarea>` : `<input class="input" data-k="${k}" value="${esc(get(cur, k))}">`}</div>`).join('') + (sec.json ? `<div class="field"><label>Cards (JSON)</label><textarea class="input" data-json="${sec.json}" style="min-height:220px;font-family:monospace;font-size:.85rem">${esc(JSON.stringify(cur[sec.json] || [], null, 2))}</textarea><span class="hint">Each card: icon, title, text${sec.key === 'why' ? ', href, cta' : ''}. Set "highlight": true or "active": true on the card that should be lime.</span></div>` : '');
      return `<form class="panel" data-sec="${sec.key}" novalidate><h2>${sec.title}</h2>${inner}<button class="btn btn-dark" type="submit">Save ${sec.title.toLowerCase().split(' ')[0]}</button></form>`;
    }).join('');
    const hero = S.hero || {};
    const heroImages = Array.isArray(hero.images) ? hero.images : hero.image_url ? [hero.image_url] : [];
    $('panel').insertAdjacentHTML('beforeend', `<form class="panel" id="heroSlidesForm"><h2>Hero banner slides</h2><div class="field"><label for="heroSlides">Slide image URLs, one per line</label><textarea class="input" id="heroSlides" style="min-height:120px">${esc(heroImages.join('\n'))}</textarea></div><div class="field"><label class="btn btn-ghost" style="width:max-content">${icon('upload', '', 16)}Upload images<input type="file" id="heroSlideUpload" accept="image/*" multiple hidden></label><span class="hint">Images are uploaded to the public media bucket and rotate in the homepage banner.</span></div><button class="btn btn-dark" type="submit">Save banner slides</button></form>`);
    const homeSections = [
      ['stats', 'Statistics'], ['talent', 'How we teach'], ['why', 'Why Courssins'], ['courses', 'Featured courses'],
      ['tutors', 'Tutors'], ['testimonials', 'Testimonials'], ['blog', 'Latest articles'], ['membership', 'Newsletter'],
    ];
    const sectionValues = new Map((Array.isArray(S.home_sections) ? S.home_sections : []).map((item) => [item.key, item]));
    $('panel').insertAdjacentHTML('beforeend', `<form class="panel" id="homeSectionsForm"><h2>Homepage sections</h2><div class="table-wrap"><table class="data"><thead><tr><th>Section</th><th>Visible</th><th>Order</th></tr></thead><tbody>${homeSections.map(([key, label], index) => {
      const value = sectionValues.get(key) || { visible: true, order: index };
      return `<tr><td>${label}</td><td><input type="checkbox" data-section-visible="${key}" ${value.visible !== false ? 'checked' : ''} aria-label="Show ${label}"></td><td><input class="input" type="number" min="0" max="99" data-section-order="${key}" value="${Number.isFinite(Number(value.order)) ? Number(value.order) : index}" aria-label="Order for ${label}"></td></tr>`;
    }).join('')}</tbody></table></div><button class="btn btn-dark" type="submit">Save homepage sections</button></form>`);

    $('heroSlidesForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = ev.currentTarget.querySelector('button[type="submit"]');
      setBusy(btn, true, 'Uploading and saving');
      const urls = $('heroSlides').value.split('\n').map((url) => url.trim()).filter(Boolean);
      for (const file of $('heroSlideUpload').files) {
        if (file.size > 10 * 1024 * 1024) { setBusy(btn, false); return toast(`${file.name} exceeds the 10 MB image limit.`, 'err'); }
        const path = `homepage/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) { setBusy(btn, false); return toast(`Image upload failed: ${uploadError.message}`, 'err'); }
        urls.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
      }
      const images = [...new Set(urls)];
      const value = { ...(S.hero || {}), images, image_url: images[0] || '' };
      const { error } = await supabase.from('settings').upsert({ key: 'hero', value, updated_at: new Date().toISOString() });
      setBusy(btn, false);
      if (error) toast(error.message, 'err');
      else { S.hero = value; toast('Hero slides saved', 'ok'); }
    });

    $('homeSectionsForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const value = homeSections.map(([key], index) => ({
        key,
        visible: $('homeSectionsForm').querySelector(`[data-section-visible="${key}"]`).checked,
        order: Math.max(0, Math.min(99, Number($('homeSectionsForm').querySelector(`[data-section-order="${key}"]`).value) || index)),
      }));
      const btn = ev.currentTarget.querySelector('button[type="submit"]');
      setBusy(btn, true, 'Saving');
      const { error } = await supabase.from('settings').upsert({ key: 'home_sections', value, updated_at: new Date().toISOString() });
      setBusy(btn, false);
      if (error) toast(error.message, 'err');
      else { S.home_sections = value; toast('Homepage sections saved', 'ok'); }
    });

    $('panel').querySelectorAll('form[data-sec]').forEach((f) => f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const sec = SITE_SPEC.find((s) => s.key === f.dataset.sec); let val;
      if (sec.rows) { val = []; [0, 1, 2, 3].forEach((i) => { const o = {}; sec.rows.forEach((k) => (o[k] = f.querySelector(`[data-k="${i}.${k}"]`).value.trim())); o.value = Number(o.value) || 0; if (o.label) val.push(o); }); }
      else { val = { ...(S[sec.key] || {}) }; f.querySelectorAll('[data-k]').forEach((i) => put(val, i.dataset.k, i.value.trim())); const j = f.querySelector('[data-json]'); if (j) { try { val[j.dataset.json] = JSON.parse(j.value || '[]'); } catch { return toast('Cards JSON is not valid.', 'err'); } } }
      const btn = f.querySelector('button'); setBusy(btn, true, 'Saving');
      const { error } = await supabase.from('settings').upsert({ key: sec.key, value: val, updated_at: new Date().toISOString() }); setBusy(btn, false);
      error ? toast(error.message, 'err') : toast('Saved', 'ok');
    }));
  }

  async function go(v) {
    v = v || 'dash'; if (v !== 'dash' && v !== 'site' && !allowed.find(([k]) => k === v)) v = 'dash'; if (v === 'site' && myRank < 3) v = 'dash';
    document.querySelectorAll('[data-v]').forEach((b) => b.classList?.contains('side-link') && b.setAttribute('aria-current', b.dataset.v === v));
    $('panelTitle').textContent = v === 'dash' ? 'Overview' : v === 'site' ? 'Website content' : E[v].t; toggle(false);
    history.replaceState(null, '', `#${v}`);
    try { await (v === 'dash' ? dash() : v === 'site' ? site() : list(v)); } catch (er) { console.error(er); $('panel').innerHTML = empty('Something went wrong', 'Refresh the page and try again.'); }
  }
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (b) go(b.dataset.v); });
  addEventListener('hashchange', () => go(location.hash.slice(1)));
  go(location.hash.slice(1));
}
