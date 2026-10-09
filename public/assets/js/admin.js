import { supabase, configured, requireAuth, signOut } from './supabase.js';
import { getSettings } from './api.js';
import { esc, money, fmtDate, icon, modal, toast, setBusy, empty, slugify, sanitizeHTML, sanitizeCSS, arr } from './ui.js';
import { joinGroupPresence, loadGroupMembers, renderGroupMembers, renderTypingIndicator } from './group-presence.js';

const $ = (id) => document.getElementById(id);
const ICONS = ['design', 'code', 'server', 'stack', 'ux', 'assist', 'pm', 'data', 'shield', 'heart', 'care'];
const T = 'tutor', A = 'admin', SU = 'super';   // minimum role that may see an entity (RLS still enforces everything server-side)
const boolCol = (v) => (v ? 'Yes' : 'No');

/* Each entity drives a list screen and an add/edit form. Field types: text textarea number select ref check lines json datetime image file */
const E = {
  students: { g: 'People', min: T, t: 'Students', table: 'profiles', ic: 'users', filter: (q) => q.eq('role', 'student'), order: ['created_at', false], create: false, edit: false, del: false,
    cols: [['full_name', 'Name'], ['email', 'Email'], ['interest', 'Programme'], ['created_at', 'Joined']],
    fields: [{ k: 'full_name', l: 'Full name', req: 1 }, { k: 'interest', l: 'Programme of interest' }] },
  users: { g: 'People', min: SU, t: 'Users', table: 'profiles', ic: 'users', order: ['created_at', false], create: false, del: false,
    cols: [['full_name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['is_active', 'Active'], ['created_at', 'Joined']],
    fields: [{ k: 'full_name', l: 'Full name', ro: 1 }, { k: 'email', l: 'Email', ro: 1 }, { k: 'phone', l: 'Phone' }, { k: 'address', l: 'Address' }, { k: 'avatar_url', l: 'Profile photo', type: 'image' }, { k: 'role', l: 'Role', type: 'select', opts: ['student', 'tutor', 'admin', 'super_admin'], req: 1, help: 'Tutors can manage content for courses assigned to them. Admins manage most content. Super admins also manage pages, settings and roles.' }] },
  tutors: { g: 'People', min: A, t: 'Tutors', table: 'tutors', ic: 'user', order: ['sort_order', true], slugFrom: 'full_name',
    cols: [['full_name', 'Name'], ['specialization', 'Specialisation'], ['published', 'Published', boolCol]],
    fields: [{ k: 'full_name', l: 'Full name', req: 1 }, { k: 'slug', l: 'URL slug', help: 'Auto-generated from the name if left empty.' }, { k: 'title', l: 'Professional title' }, { k: 'specialization', l: 'Specialisation' }, { k: 'bio', l: 'Biography', type: 'textarea' }, { k: 'experience', l: 'Experience', type: 'textarea' },
      { k: 'qualifications', l: 'Qualifications (one per line)', type: 'lines' }, { k: 'expertise', l: 'Areas of expertise (one per line)', type: 'lines' }, { k: 'socials', l: 'Social links (JSON)', type: 'json', help: 'Example: {"linkedin":"https://...","x":"https://..."}' }, { k: 'email', l: 'Public contact email' },
      { k: 'image_url', l: 'Photograph', type: 'image' }, { k: 'user_id', l: 'Linked login account (lets the tutor manage their own course content)', type: 'ref', ref: ['profiles', 'full_name'], opt: 1 }, { k: 'published', l: 'Published', type: 'check', def: true }, { k: 'sort_order', l: 'Display order', type: 'number', def: 0 }] },
  courses: { g: 'Learning', min: A, t: 'Courses', table: 'courses', ic: 'book', order: ['sort_order', true], slugFrom: 'title',
    cols: [['title', 'Title'], ['category', 'Category'], ['duration', 'Duration'], ['price', 'Price', (v, r) => money(v, r.currency)], ['tutor_ids', 'Tutors'], ['published', 'Published', boolCol]],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'slug', l: 'URL slug' }, { k: 'category', l: 'Category' }, { k: 'icon', l: 'Icon', type: 'select', opts: ICONS }, { k: 'short_description', l: 'Short description', type: 'textarea' }, { k: 'description', l: 'Full description', type: 'textarea' }, { k: 'duration', l: 'Duration (e.g. 8 weeks)' }, { k: 'price', l: 'Price', type: 'number', def: 0, req: 1, help: 'Use 0 for a free course (unlocks immediately).' }, { k: 'currency', l: 'Currency', def: 'NGN' },
      { k: 'lessons_start_at', l: 'Lessons and materials start date', type: 'datetime', help: 'Students can see course outlines before this date. Lessons and materials unlock at this time.' }, { k: 'tutor_ids', l: 'Assigned tutors', type: 'refs', ref: ['tutors', 'full_name'], help: 'Select every tutor assigned to this course.' }, { k: 'image_url', l: 'Course image', type: 'image' }, { k: 'intro_video_url', l: 'Course introduction video (optional HTTPS, YouTube or Vimeo URL)' }, { k: 'why_important', l: 'Why this course is important', type: 'textarea' }, { k: 'career_paths', l: 'Career paths (one per line)', type: 'lines' }, { k: 'outcomes', l: 'Learning outcomes (one per line)', type: 'lines' }, { k: 'requirements', l: 'Requirements (one per line)', type: 'lines' }, { k: 'faqs', l: 'FAQs (JSON)', type: 'json', help: 'Example: [{"q":"Question?","a":"Answer."}]' },
      { k: 'assessment_info', l: 'Assessment information', type: 'textarea' }, { k: 'certificate_info', l: 'Certificate information', type: 'textarea' }, { k: 'featured', l: 'Show on homepage', type: 'check' }, { k: 'published', l: 'Published', type: 'check', def: true }, { k: 'sort_order', l: 'Display order', type: 'number', def: 0 }] },
  modules: { g: 'Learning', min: T, t: 'Course modules', table: 'course_modules', ic: 'stack', order: ['position', true],
    cols: [['course_id', 'Course'], ['position', '#'], ['title', 'Title']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'summary', l: 'Summary', type: 'textarea' }, { k: 'topics', l: 'Topics (one per line)', type: 'lines' }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  lessons: { g: 'Learning', min: T, t: 'Lessons', table: 'lessons', ic: 'play', order: ['position', true],
    cols: [['title', 'Title'], ['course_id', 'Course'], ['is_preview', 'Free preview', boolCol], ['position', '#']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'module_id', l: 'Module', type: 'ref', ref: ['course_modules', 'title'], opt: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'content', l: 'Lesson notes', type: 'textarea' }, { k: 'video_url', l: 'Video URL (YouTube, Vimeo, or direct HTTPS link)' }, { k: 'video_path', l: 'Upload lesson video (optional)', type: 'privateFile', maxSize: 500 * 1024 * 1024 }, { k: 'duration_min', l: 'Duration (minutes)', type: 'number' }, { k: 'is_preview', l: 'Free preview (visible without enrolling)', type: 'check' }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  resources: { g: 'Learning', min: T, t: 'Course resources', table: 'course_resources', ic: 'file', order: ['created_at', false],
    cols: [['title', 'Title'], ['course_id', 'Course'], ['resource_type', 'Type'], ['published', 'Published', boolCol]],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'module_id', l: 'Module (optional)', type: 'ref', ref: ['course_modules', 'title'], opt: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'resource_type', l: 'Resource type', type: 'select', opts: ['video', 'pdf', 'note', 'assignment'], req: 1 }, { k: 'description', l: 'Description or instructions', type: 'textarea' }, { k: 'object_path', l: 'Private uploaded file', type: 'privateFile' }, { k: 'external_url', l: 'External video or file URL' }, { k: 'published', l: 'Visible to enrolled students', type: 'check', def: true }] },
  assignments: { g: 'Learning', min: T, t: 'Assignments', table: 'assignments', ic: 'file', order: ['position', true],
    cols: [['title', 'Title'], ['course_id', 'Course'], ['is_project', 'Project', boolCol], ['due_at', 'Submission deadline'], ['max_score', 'Max score']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'module_id', l: 'Module', type: 'ref', ref: ['course_modules', 'title'], opt: 1 }, { k: 'title', l: 'Title', req: 1 }, { k: 'instructions', l: 'Instructions', type: 'textarea' }, { k: 'attachment_url', l: 'Assignment file or website link' }, { k: 'is_project', l: 'Project (must be tutor-checked before certificate)', type: 'check' }, { k: 'due_at', l: 'Submission deadline', type: 'datetime' }, { k: 'max_score', l: 'Maximum score', type: 'number', def: 100 }, { k: 'due_days', l: 'Days allowed (optional)', type: 'number' }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  discussions: { g: 'Learning', min: T, t: 'Course discussions', table: 'course_discussions', ic: 'chat', order: ['created_at', false], create: false, edit: false,
    cols: [['course_id', 'Course'], ['lesson_id', 'Section'], ['author_name', 'Author'], ['body', 'Message'], ['created_at', 'Posted']],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'lesson_id', l: 'Section', type: 'ref', ref: ['lessons', 'title'], opt: 1 }, { k: 'body', l: 'Message', type: 'textarea', req: 1 }] },
  reviews: { g: 'Content', min: A, t: 'Course reviews', table: 'course_reviews', ic: 'star', order: ['created_at', false],
    cols: [['name', 'Student'], ['course_id', 'Course'], ['rating', 'Rating'], ['approved', 'Homepage approved', boolCol], ['created_at', 'Date']],
    fields: [{ k: 'name', l: 'Student name', ro: 1 }, { k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], ro: 1 }, { k: 'rating', l: 'Rating', type: 'number', ro: 1 }, { k: 'comment', l: 'Review', type: 'textarea', ro: 1 }, { k: 'approved', l: 'Approved for public display', type: 'check' }] },
  testimonials: { g: 'Content', min: A, t: 'Testimonials', table: 'testimonials', ic: 'chat', order: ['sort_order', true], slugFrom: 'name',
    cols: [['name', 'Name'], ['programme', 'Programme'], ['published', 'Published', boolCol], ['sort_order', 'Order']],
    fields: [{ k: 'name', l: 'Name', req: 1 }, { k: 'quote', l: 'Testimonial', type: 'textarea', req: 1 }, { k: 'programme', l: 'Programme or course' }, { k: 'image_url', l: 'Photo', type: 'image' }, { k: 'published', l: 'Published', type: 'check', def: true }, { k: 'sort_order', l: 'Display order', type: 'number', def: 0 }] },
  submissions: { g: 'Learning', min: T, t: 'Submissions', table: 'assignment_submissions', ic: 'edit', order: ['submitted_at', false], create: false, editLabel: 'Grade',
    cols: [['assignment_id', 'Assignment'], ['user_id', 'Student'], ['file_path', 'Uploaded file'], ['status', 'Status'], ['score', 'Score'], ['submitted_at', 'Submitted']],
    before: (v) => ({ ...v, status: v.score !== null ? 'graded' : 'submitted', graded_at: v.score !== null ? new Date().toISOString() : null }),
    fields: [{ k: 'assignment_id', l: 'Assignment', type: 'ref', ref: ['assignments', 'title'], ro: 1 }, { k: 'user_id', l: 'Student', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }, { k: 'file_path', l: 'Uploaded file', type: 'privateAsset', ro: 1 }, { k: 'content', l: 'Answer', type: 'textarea', ro: 1 }, { k: 'link_url', l: 'Link', ro: 1 }, { k: 'score', l: 'Score', type: 'number' }, { k: 'feedback', l: 'Feedback', type: 'textarea' }] },
  exams: { g: 'Learning', min: T, t: 'Quizzes', table: 'exams', ic: 'quiz',
    cols: [['title', 'Title'], ['course_id', 'Course'], ['pass_mark', 'Pass mark'], ['published', 'Published', boolCol]],
    fields: [{ k: 'course_id', l: 'Course', type: 'ref', ref: ['courses', 'title'], req: 1 }, { k: 'module_id', l: 'Module (leave blank for final)', type: 'ref', ref: ['course_modules', 'title'], opt: 1 }, { k: 'is_final', l: 'Final course quiz', type: 'check', help: 'Final quizzes require 15 questions. Module quizzes require 7.' }, { k: 'title', l: 'Title', req: 1 }, { k: 'instructions', l: 'Instructions', type: 'textarea' }, { k: 'duration_min', l: 'Quiz timer (minutes)', type: 'number', def: 13, req: 1, help: 'Choose the time students have to complete this quiz.' }, { k: 'pass_mark', l: 'Pass mark (%)', type: 'number', def: 50 }, { k: 'published', l: 'Published', type: 'check', def: false }] },
  questions: { g: 'Learning', min: T, t: 'Quiz questions', table: 'exam_questions', ic: 'list', order: ['position', true],
    cols: [['exam_id', 'Quiz'], ['position', '#'], ['question', 'Question']],
    fields: [{ k: 'exam_id', l: 'Quiz', type: 'ref', ref: ['exams', 'title'], req: 1 }, { k: 'question', l: 'Question', type: 'textarea', req: 1 }, { k: 'options', l: 'Answer options (one per line)', type: 'lines', req: 1 }, { k: 'correct_index', l: 'Correct option number', type: 'number', def: 0, req: 1, help: 'Count from 1: 1 = the first option listed.', off: 1 }, { k: 'position', l: 'Position', type: 'number', def: 1 }] },
  results: { g: 'Learning', min: T, t: 'Quiz results', table: 'exam_results', ic: 'chart', order: ['taken_at', false], create: false, edit: false,
    cols: [['exam_id', 'Quiz'], ['user_id', 'Student'], ['score', 'Score %'], ['passed', 'Passed', boolCol], ['taken_at', 'Taken']], fields: [{ k: 'exam_id', l: 'Quiz', type: 'ref', ref: ['exams', 'title'], ro: 1 }, { k: 'user_id', l: 'Student', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }] },
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
  staff_id_cards: { g: 'People', min: A, t: 'Staff ID cards', table: 'staff_id_cards', ic: 'user', order: ['issued_at', false], create: false, del: false,
    cols: [['card_number', 'Card number'], ['user_id', 'Staff member'], ['issue_year', 'Issue year'], ['status', 'Status'], ['issued_at', 'Issued']],
    fields: [{ k: 'card_number', l: 'Card number', ro: 1 }, { k: 'user_id', l: 'Staff member', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }, { k: 'issue_year', l: 'Issue year', type: 'number', ro: 1 }, { k: 'status', l: 'Status', type: 'select', opts: ['valid', 'revoked'], req: 1 }, { k: 'revoked_reason', l: 'Revocation reason', type: 'textarea' }] },
  events: { g: 'Content', min: A, t: 'Events', table: 'events', ic: 'calendar', order: ['starts_at', false],
    cols: [['title', 'Title'], ['starts_at', 'Starts'], ['location', 'Location'], ['published', 'Published', boolCol]],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'description', l: 'Description', type: 'textarea' }, { k: 'starts_at', l: 'Date and time', type: 'datetime' }, { k: 'location_type', l: 'Location format', type: 'select', opts: ['physical', 'virtual'], def: 'physical' }, { k: 'location', l: 'Venue or virtual meeting link' }, { k: 'url', l: 'Event details / booking link' }, { k: 'fee', l: 'Ticket fee (0 for free)', type: 'number', def: 0 }, { k: 'currency', l: 'Currency', def: 'NGN' }, { k: 'capacity', l: 'Ticket capacity (optional)', type: 'number' }, { k: 'image_url', l: 'Poster image', type: 'image' }, { k: 'published', l: 'Published', type: 'check', def: true }] },
  advertisements: { g: 'Content', min: A, t: 'Advertisements', table: 'advertisements', ic: 'sparkle', order: ['created_at', false],
    cols: [['title', 'Title'], ['active', 'Active', boolCol], ['starts_at', 'Starts'], ['ends_at', 'Ends']],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'description', l: 'Description', type: 'textarea' }, { k: 'media_type', l: 'Media format', type: 'select', opts: ['image', 'video'], def: 'image' }, { k: 'media_url', l: 'Poster, flyer or video file', type: 'media', req: 1, help: 'Image or video up to 500 MB.' }, { k: 'button_text', l: 'Button label' }, { k: 'target_url', l: 'Destination URL' }, { k: 'active', l: 'Active', type: 'check' }, { k: 'starts_at', l: 'Starts', type: 'datetime' }, { k: 'ends_at', l: 'Ends', type: 'datetime' }] },
  library: { g: 'Content', min: A, t: 'Library', table: 'library', ic: 'stack', order: ['created_at', false],
    cols: [['title', 'Title'], ['type', 'Type'], ['access', 'Access'], ['published', 'Published', boolCol]],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'type', l: 'Type', type: 'select', opts: ['book', 'pdf', 'material', 'video', 'document'], def: 'book' }, { k: 'description', l: 'Description', type: 'textarea' }, { k: 'object_path', l: 'PDF book upload (private for paid items)', type: 'libraryFile' }, { k: 'url', l: 'External website URL (free items)', help: 'Paid books must be uploaded as a private PDF.' }, { k: 'preview_urls', l: 'First six page previews', type: 'json', def: [] }, { k: 'cover_url', l: 'Cover image', type: 'image' }, { k: 'course_id', l: 'Related course', type: 'ref', ref: ['courses', 'title'], opt: 1 }, { k: 'pricing', l: 'Price type', type: 'select', opts: ['free', 'paid'], def: 'free' }, { k: 'price', l: 'Amount (0 for free)', type: 'number', def: 0 }, { k: 'currency', l: 'Currency', def: 'NGN' }, { k: 'access', l: 'Visibility', type: 'select', opts: ['public', 'members'], def: 'public' }, { k: 'published', l: 'Published', type: 'check', def: true }] },
  event_tickets: { g: 'Events', min: A, t: 'Event tickets', table: 'event_tickets', ic: 'calendar', order: ['created_at', false], create: false, edit: false, del: false, cols: [['ticket_code', 'Verification code'], ['event_id', 'Event'], ['user_id', 'Attendee'], ['status', 'Status'], ['created_at', 'Booked']], fields: [{ k: 'ticket_code', l: 'Ticket code', ro: 1 }, { k: 'event_id', l: 'Event', type: 'ref', ref: ['events', 'title'], ro: 1 }, { k: 'user_id', l: 'Attendee', type: 'ref', ref: ['profiles', 'full_name'], ro: 1 }, { k: 'status', l: 'Status', ro: 1 }] },
  blog: { g: 'Content', min: A, t: 'Blog posts', table: 'blog_posts', ic: 'edit', order: ['published_at', false], slugFrom: 'title', preview: { html: 'content' },
    cols: [['title', 'Title'], ['category', 'Category'], ['author', 'Author'], ['published', 'Published', boolCol], ['published_at', 'Date']],
    fields: [{ k: 'title', l: 'Title', req: 1 }, { k: 'slug', l: 'URL slug' }, { k: 'excerpt', l: 'Short description', type: 'textarea' }, { k: 'content', l: 'Article body (HTML: p, h2, ul, img, a)', type: 'textarea', tall: 1 }, { k: 'category', l: 'Category' }, { k: 'author', l: 'Author' }, { k: 'image_url', l: 'Article image', type: 'image' }, { k: 'published_at', l: 'Publication date', type: 'datetime' }, { k: 'published', l: 'Published (untick to unpublish)', type: 'check' }] },
  pages: { g: 'Content', min: SU, t: 'Pages', table: 'pages', ic: 'file', order: ['updated_at', false], slugFrom: 'title', preview: { html: 'html', css: 'css' },
    before: (v) => ({ ...v, updated_at: new Date().toISOString() }),
    cols: [['title', 'Title'], ['slug', 'Slug'], ['published', 'Published', boolCol], ['updated_at', 'Updated']],
    fields: [{ k: 'title', l: 'Page title', req: 1 }, { k: 'slug', l: 'Page slug (lowercase, hyphens)', req: 1, help: 'The page will live at page.html?slug=your-slug' }, { k: 'html', l: 'HTML content', type: 'textarea', tall: 1, help: 'Scripts, iframes, forms and inline event handlers are removed automatically. The Courssins header and footer are added around your page.' }, { k: 'css', l: 'Custom CSS (applies to this page only)', type: 'textarea' }, { k: 'image_url', l: 'Page image', type: 'image' }, { k: 'meta_title', l: 'Meta title' }, { k: 'meta_description', l: 'Meta description' }, { k: 'published', l: 'Published', type: 'check' }] },
  subscribers: { g: 'Content', min: A, t: 'Newsletter', table: 'newsletter_subscribers', ic: 'mail', order: ['created_at', false], create: false, edit: false, cols: [['email', 'Email'], ['created_at', 'Subscribed']], fields: [] },
  messages: { g: 'Content', min: A, t: 'Contact messages', table: 'contact_messages', ic: 'chat', order: ['created_at', false], create: false, readonly: 1,
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
  { key: 'certificate', title: 'Certificate signature', fields: [['organisation', 'Organisation name'], ['signatory_name', 'Signatory name'], ['signatory', 'Signatory title'], ['signature_url', 'Signature image', 'image']] },
];

const rank = { tutor: 1, admin: 2, super_admin: 3 };
const need = { [T]: 1, [A]: 2, [SU]: 3 };
if (!configured) {
  $('panel').innerHTML = `<div class="panel"><h2>Connect Supabase to use the admin area</h2><p class="muted">Add your project URL and anon key in <code>assets/js/config.js</code>, then create your Super Admin (see README).</p><a class="btn btn-lime" style="margin-top:16px" href="index.html">Back to website</a></div>`;
} else {
  const me = await requireAuth(['tutor', 'admin', 'super_admin']);
  $('whoami').textContent = `${me.full_name || me.email} Â· ${me.role.replace('_', ' ')}`;
  const liveStatus = document.createElement('span'); liveStatus.className = 'dashboard-live is-connecting'; liveStatus.setAttribute('role', 'status'); liveStatus.innerHTML = '<i></i><span>Connecting</span><time></time>'; $('whoami').insertAdjacentElement('afterend', liveStatus);
  const setLiveStatus = (state, label) => { liveStatus.className = `dashboard-live ${state}`; liveStatus.querySelector('span').textContent = label; };
  const updateLiveClock = () => { liveStatus.querySelector('time').textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()); };
  updateLiveClock(); setInterval(updateLiveClock, 30000);
  const myRank = rank[me.role];
  const allowed = Object.entries(E).filter(([key, e]) => myRank >= need[e.min] && !(me.role === T && key === 'modules'));
  const groups = [...new Set(allowed.map(([, e]) => e.g))];
  const links = [`<button class="side-link" data-v="dash">${icon('grid', '', 18)}Overview</button>`];
  groups.forEach((g) => { links.push(`<div class="side-label">${g}</div>`); if (g === 'Learning') links.push(`<button class="side-link" data-v="builder">${icon('stack', '', 18)}Course builder</button>`); allowed.filter(([, e]) => e.g === g).forEach(([k, e]) => links.push(`<button class="side-link" data-v="${k}">${icon(e.ic, '', 18)}${e.t}</button>`)); });
  if (me.role === T) links.push(`<button class="side-link" data-v="tutor-profile">${icon('user', '', 18)}My tutor profile</button>`);
  links.push(`<button class="side-link" data-v="staff-inbox">${icon('chat', '', 18)}Staff inbox</button>`);
  if (myRank >= 2) links.push(`<button class="side-link" data-v="student-id-directory">${icon('user', '', 18)}Student ID cards</button>`);
  if (me.role === T) links.push(`<button class="side-link" data-v="tutor-groups">${icon('users', '', 18)}Course discussions</button>`);
  links.push(`<button class="side-link" data-v="staff-id">${icon('user', '', 18)}My staff ID</button>`);
  if (myRank >= 2) links.push(`<a class="side-link" href="ticket-verify.html">${icon('calendar', '', 18)}Ticket verification</a>`);
  if (myRank >= 3) links.push('<div class="side-label">Site</div>', `<button class="side-link" data-v="site">${icon('settings', '', 18)}Website content</button>`);
  $('sideNav').innerHTML = links.join('');
  $('signOutBtn').addEventListener('click', signOut);
  const side = $('sidebar'), scrim = $('scrim'), toggle = (o) => { side.classList.toggle('open', o); scrim.classList.toggle('open', o); };
  $('menuBtn').addEventListener('click', () => toggle(true)); scrim.addEventListener('click', () => toggle(false));

  const refCache = {};
  let tutorGroupChannel = null;
  let tutorGroupPresence = null;
  let tutorTypingTimer = null;
  let activeTutorGroupId = null;
  let activeAdminView = 'dash';
  let adminOverviewRefresh = null;
  let builderCourseId = null;
  let assignedCourseIdsCache;
  async function assignedCourseIds() {
    if (assignedCourseIdsCache) return assignedCourseIdsCache;
    const { data: tutorRows } = await supabase.from('tutors').select('id').eq('user_id', me.id);
    const tutorIds = (tutorRows || []).map((tutor) => tutor.id);
    if (!tutorIds.length) return (assignedCourseIdsCache = []);
    const { data: assignments } = await supabase.from('course_tutors').select('course_id').in('tutor_id', tutorIds);
    return (assignedCourseIdsCache = [...new Set((assignments || []).map((assignment) => assignment.course_id))]);
  }
  async function refMap(table, label) {
    const key = `${table}.${label}`; if (refCache[key]) return refCache[key];
    if (table === 'profiles' && me.role === 'tutor') {
      const { data: students } = await supabase.rpc('get_my_course_students');
      return (refCache[key] = Object.fromEntries((students || []).map((student) => [student.student_id, student.full_name || '(unnamed)'])));
    }
    if (table === 'courses' && me.role === 'tutor') {
      const courseIds = await assignedCourseIds();
      if (!courseIds.length) return (refCache[key] = {});
      const { data: courses } = await supabase.from('courses').select(`id,${label}`).in('id', courseIds).limit(1000);
      return (refCache[key] = Object.fromEntries((courses || []).map((course) => [course.id, course[label] || '(unnamed)'])));
    }
    let query = supabase.from(table).select(`id,${label}`).limit(1000);
    if (me.role === 'tutor' && ['course_modules', 'lessons', 'assignments', 'exams'].includes(table)) {
      const courseIds = await assignedCourseIds();
      if (!courseIds.length) return (refCache[key] = {});
      query = query.in('course_id', courseIds);
    }
    const { data } = await query;
    return (refCache[key] = Object.fromEntries((data || []).map((r) => [r.id, r[label] || '(unnamed)'])));
  }
  const fmt = (col, row, maps) => {
    const [k, , f] = col; const v = row[k]; const fld = maps.fields[k];
    if (f) return esc(f(v, row));
    if (fld?.type === 'ref') return esc(maps.refs[k]?.[v] || '');
    if (fld?.type === 'refs') return esc((v || []).map((id) => maps.refs[k]?.[id]).filter(Boolean).join(', '));
    if (fld?.type === 'privateAsset') return v ? 'Attached' : '';
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
    let data, error;
    if (key === 'students' && me.role === T) {
      const result = await supabase.rpc('get_my_course_students');
      error = result.error;
      data = (result.data || []).map((student) => ({ ...student, id: student.student_id, created_at: student.joined_at }));
    } else {
      let q = supabase.from(e.table).select('*').order(e.order[0], { ascending: e.order[1] }).limit(500); if (e.filter) q = e.filter(q);
      if (me.role === T && ['modules', 'lessons', 'resources', 'assignments', 'exams', 'questions', 'results', 'discussions'].includes(key)) {
        const courseIds = await assignedCourseIds();
        if (key === 'questions') {
          const { data: ownedExams, error: examError } = await supabase.from('exams').select('id').in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']);
          if (examError) { $('panel').innerHTML = empty('Could not load quizzes', examError.message); return; }
          q = q.in('exam_id', (ownedExams || []).map((exam) => exam.id).length ? (ownedExams || []).map((exam) => exam.id) : ['00000000-0000-0000-0000-000000000000']);
        } else q = courseIds.length ? q.in('course_id', courseIds) : q.eq('course_id', '00000000-0000-0000-0000-000000000000');
      }
      const result = await q; data = result.data; error = result.error;
    }
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
        return `<div class="field"><label for="${id}">${esc(f.l)}</label><div style="display:flex;gap:8px"><input class="input" id="${id}" type="text" value="${esc(v ?? '')}" readonly><label class="btn btn-ghost" style="flex:none;height:54px">${icon('upload', '', 18)}Upload<input type="file" hidden data-private-up="${id}" accept="${f.k === 'video_path' ? 'video/*' : 'video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt'}"></label></div><span class="hint">Private to enrolled students and assigned tutors. Maximum file size: ${f.maxSize ? '500 MB' : '50 MB'}.</span></div>`;
      }
      if (f.type === 'libraryFile') return `<div class="field"><label for="${id}">${esc(f.l)}</label><div style="display:flex;gap:8px"><input class="input" id="${id}" value="${esc(v || '')}" readonly><label class="btn btn-ghost" style="flex:none;height:54px">${icon('upload', '', 18)}Upload PDF<input type="file" hidden data-library-up="${id}" accept="application/pdf,.pdf"></label></div><span class="hint">Uploads use private storage. The first six preview pages are generated as small public images.</span></div>`;
      if (f.type === 'privateAsset') return `<div class="field"><label for="${id}">${esc(f.l)}</label><div style="display:flex;gap:8px"><input class="input" id="${id}" value="${esc(v || '')}" readonly><button class="btn btn-ghost" type="button" data-private-download="${id}" ${v ? '' : 'disabled'}>${icon('download', '', 16)}Download securely</button></div></div>`;
      let ctl;
      if (f.type === 'textarea' || f.type === 'lines' || f.type === 'json') {
        if (f.type === 'lines') v = arr(v).join('\n'); if (f.type === 'json') v = v == null ? '' : JSON.stringify(v, null, 2);
        ctl = `<textarea class="input" id="${id}" ${dis} style="${f.tall ? 'min-height:280px' : ''};${f.type === 'json' ? 'font-family:monospace;font-size:.85rem' : ''}">${esc(v ?? '')}</textarea>`;
      } else if (f.type === 'select') ctl = `<select class="input" id="${id}" ${dis}>${f.opts.map((o) => `<option ${o === (v ?? f.opts[0]) ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      else if (f.type === 'ref') ctl = `<select class="input" id="${id}" ${dis}>${f.opt || !editing ? '<option value="">' + (f.opt ? 'None' : 'Select') + '</option>' : ''}${Object.entries(refOpts[f.k]).map(([i, l]) => `<option value="${i}" ${i === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      else if (f.type === 'check') return `<label class="check" style="margin-bottom:18px"><input type="checkbox" id="${id}" ${v ? 'checked' : ''} ${dis}> ${esc(f.l)}</label>`;
      else if (f.type === 'datetime') ctl = `<input class="input" id="${id}" type="datetime-local" value="${toLocal(v || (f.k === 'published_at' && !editing ? new Date() : ''))}" ${dis}>`;
      else if (f.type === 'number') ctl = `<input class="input" id="${id}" type="number" step="any" value="${v == null ? '' : (f.off ? Number(v) + 1 : v)}" ${dis}>`;
      else if (f.type === 'image' || f.type === 'file' || f.type === 'media') ctl = `<div style="display:flex;gap:8px"><input class="input" id="${id}" type="text" value="${esc(v ?? '')}" placeholder="https://â€¦ or upload" ${dis}><label class="btn btn-ghost" style="flex:none;height:54px">${icon('upload', '', 18)}Upload<input type="file" hidden data-up="${id}" accept="${f.type === 'image' ? 'image/*' : f.type === 'media' ? 'image/*,video/*' : '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,video/mp4,video/webm,image/*'}"></label></div>`;
      else ctl = `<input class="input" id="${id}" type="text" value="${esc(v ?? '')}" ${dis}>`;
      return `<div class="field"><label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>${ctl}${help}</div>`;
    }).join('');
    const prev = e.preview ? `<button class="btn btn-ghost" id="prevBtn" type="button">Preview</button>` : '';
    const m = modal({ title: `${editing ? (e.readonly ? 'View' : 'Edit') : 'Add'} ${e.t.toLowerCase().replace(/s$/, '')}`, wide: true, body: `<form id="entForm" novalidate>${html}</form>`, actions: e.readonly ? '' : `${prev}<button class="btn btn-lime" id="saveBtn" type="button">Save</button>` });
    m.el.querySelectorAll('[data-up]').forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return; const mediaField = E[key]?.fields.find((field) => `f_${field.k}` === inp.dataset.up)?.type === 'media'; if (f.size > (mediaField ? 500 : 25) * 1024 * 1024) return toast(mediaField ? 'Ad media must be 500 MB or smaller.' : 'File is larger than 25 MB.', 'err');
      const path = `${key}/${Date.now()}-${f.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      toast('Uploadingâ€¦'); const { error } = await supabase.storage.from('media').upload(path, f, { upsert: false, contentType: f.type });
      if (error) return toast(`Upload failed: ${error.message}`, 'err');
      m.el.querySelector(`#${inp.dataset.up}`).value = supabase.storage.from('media').getPublicUrl(path).data.publicUrl; toast('Uploaded', 'ok');
    }));
    m.el.querySelectorAll('[data-library-up]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      if (file.type !== 'application/pdf' || file.size > 100 * 1024 * 1024) return toast('Choose a PDF up to 100 MB.', 'err');
      const path = `books/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      toast('Uploading private PDFâ€¦'); const { error: uploadError } = await supabase.storage.from('library-files').upload(path, file, { contentType: 'application/pdf' });
      if (uploadError) return toast(uploadError.message, 'err');
      m.el.querySelector(`#${input.dataset.libraryUp}`).value = path;
      try {
        const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
        const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; const previews = [];
        for (let pageNo = 1; pageNo <= Math.min(6, pdf.numPages); pageNo += 1) {
          const page = await pdf.getPage(pageNo), viewport = page.getViewport({ scale: Math.min(1, 1000 / page.getViewport({ scale: 1 }).width) }); const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height; await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .78)); const previewPath = `library-previews/${crypto.randomUUID()}-${pageNo}.jpg`; const { error } = await supabase.storage.from('media').upload(previewPath, blob, { contentType: 'image/jpeg' }); if (error) throw error; previews.push(supabase.storage.from('media').getPublicUrl(previewPath).data.publicUrl);
        }
        m.el.querySelector('#f_preview_urls').value = JSON.stringify(previews); toast('Private PDF and six preview pages uploaded.', 'ok');
      } catch (previewError) { toast(`PDF uploaded, but preview images could not be generated: ${previewError.message}`, 'err'); }
    }));
    m.el.querySelectorAll('[data-private-up]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      const field = E[key]?.fields.find((item) => `f_${item.k}` === input.dataset.privateUp);
      const maxSize = field?.maxSize || 50 * 1024 * 1024;
      if (file.size > maxSize) return toast(`File exceeds the ${Math.round(maxSize / 1024 / 1024)} MB limit.`, 'err');
      if (field?.k === 'video_path' && !file.type.startsWith('video/')) return toast('Choose a video file.', 'err');
      const courseId = m.el.querySelector('#f_course_id')?.value;
      if (!courseId) return toast('Select a course before uploading its resource.', 'err');
      const path = `${courseId}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      toast('Uploading private course resourceâ€¦');
      const { error } = await supabase.storage.from('course-materials').upload(path, file, { upsert: false, contentType: file.type });
      if (error) return toast(`Upload failed: ${error.message}`, 'err');
      m.el.querySelector(`#${input.dataset.privateUp}`).value = path;
      toast('Resource uploaded privately', 'ok');
    }));
    m.el.querySelectorAll('[data-private-download]').forEach((button) => button.addEventListener('click', async () => {
      const objectPath = m.el.querySelector(`#${button.dataset.privateDownload}`).value;
      if (!objectPath) return;
      const { data, error } = await supabase.storage.from('course-materials').createSignedUrl(objectPath, 3600);
      if (error || !data?.signedUrl) return toast('Could not create a secure download link.', 'err');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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
        else if (f.type === 'json') { try { x = x ? JSON.parse(x) : (Array.isArray(f.def) ? f.def : (f.k === 'faqs' ? [] : {})); } catch { errs.push(`${f.l}: not valid JSON`); continue; } }
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
      if (key === 'library') {
        if (!v.object_path && !v.url) errs.push('Upload a PDF or add an external website URL.');
        if (v.pricing === 'paid' && !v.object_path) errs.push('Paid library items must be uploaded as a private PDF.');
        if (v.pricing === 'paid' && !(Number(v.price) > 0)) errs.push('Enter a price greater than zero for paid items.');
        if (v.object_path) v.url = null;
        if (v.pricing === 'free') v.price = 0;
      }
      if (key === 'exams') {
        if (v.is_final && v.module_id) errs.push('Final assessments must not be attached to a module');
        if (!v.is_final && !v.module_id) errs.push('Choose a module or mark this as the final assessment');
        if (Number(v.pass_mark) < 50) errs.push('The minimum passing score is 50%.');
        if (v.is_final) v.module_id = null;
        if (!Number.isInteger(Number(v.duration_min)) || Number(v.duration_min) < 1 || Number(v.duration_min) > 180) errs.push('Quiz duration must be between 1 and 180 minutes.');
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
    if (me.role === T) {
      const ids = await assignedCourseIds();
      const [{ data: students }, sections, groups] = await Promise.all([
        supabase.rpc('get_my_course_students'),
        ids.length ? c('lessons', (q) => q.in('course_id', ids)) : Promise.resolve(0),
        c('tutor_groups', (q) => q.eq('owner_id', me.id)),
      ]);
      const studentCount = new Set((students || []).map((student) => student.student_id)).size;
      $('panel').innerHTML = `<div class="kpis"><button class="kpi lime" data-v="students"><b>${studentCount}</b><span>Enrolled students</span></button><button class="kpi" data-v="courses"><b>${ids.length}</b><span>Assigned courses</span></button><button class="kpi" data-v="builder"><b>${sections}</b><span>Course sections</span></button><button class="kpi" data-v="tutor-groups"><b>${groups}</b><span>Discussion groups</span></button></div><div class="panel"><h2>Teaching workspace</h2><div class="btn-row"><button class="btn btn-dark" data-v="builder">Build course modules</button><button class="btn btn-outline" data-v="staff-inbox">Open staff inbox</button><button class="btn btn-outline" data-v="tutor-groups">Manage course discussions</button></div></div>`;
      return;
    }
    const [st, co, en, pend, sub, msg] = await Promise.all([c('profiles', (q) => q.eq('role', 'student')), c('courses'), c('enrollments', (q) => q.eq('status', 'active')), c('payments', (q) => q.eq('status', 'pending')), c('newsletter_subscribers'), c('contact_messages')]);
    const { data: paid } = await supabase.from('payments').select('amount').eq('status', 'success');
    const tot = (paid || []).reduce((n, p) => n + Number(p.amount), 0);
    $('panel').innerHTML = `<div class="kpis"><button class="kpi lime" data-v="students"><b>${st}</b><span>Students</span></button><button class="kpi" data-v="courses"><b>${co}</b><span>Courses</span></button><button class="kpi" data-v="enrollments"><b>${en}</b><span>Active enrolments</span></button><button class="kpi" data-v="payments"><b>${pend}</b><span>Pending payments</span></button></div>
    <div class="kpis"><button class="kpi" data-v="payments"><b>${money(tot)}</b><span>Verified payments</span></button><button class="kpi" data-v="subscribers"><b>${sub}</b><span>Newsletter subscribers</span></button><button class="kpi" data-v="messages"><b>${msg}</b><span>Contact messages</span></button></div>
    <div class="panel"><h2>Quick actions</h2><div class="btn-row">${allowed.some(([k]) => k === 'courses') ? '<button class="btn btn-dark" data-v="courses">Manage courses</button>' : ''}${allowed.some(([k]) => k === 'blog') ? '<button class="btn btn-dark" data-v="blog">Write an article</button>' : ''}${allowed.some(([k]) => k === 'payments') ? '<button class="btn btn-dark" data-v="payments">Review payments</button>' : ''}${allowed.some(([k]) => k === 'lessons') ? '<button class="btn btn-dark" data-v="lessons">Add lessons</button>' : ''}</div></div>`;
  }

  async function staffInbox(selectedId = null) {
    const [{ data: messages, error }, { data: tutors }] = await Promise.all([
      supabase.from('staff_messages').select('*').order('created_at', { ascending: true }).limit(300),
      me.role === T ? Promise.resolve({ data: [] }) : supabase.from('profiles').select('id,full_name,email,role').in('role', ['tutor', 'admin', 'super_admin']).eq('is_active', true).order('full_name'),
    ]);
    if (error) { $('panel').innerHTML = empty('Inbox unavailable', error.message); return; }
    const all = messages || [], byId = new Map(all.map((message) => [message.id, message]));
    const roots = all.filter((message) => !message.parent_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const person = (id) => id === me.id ? 'You' : (tutors || []).find((t) => t.id === id)?.full_name || (tutors || []).find((t) => t.id === id)?.email || 'Staff member';
    const conversationName = (root) => root.recipient_id ? (root.sender_id === me.id ? person(root.recipient_id) : person(root.sender_id)) : 'All tutors';
    const active = roots.find((root) => root.id === selectedId) || roots[0] || null;
    const thread = active ? all.filter((m) => m.id === active.id || m.parent_id === active.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : [];
    $('panel').innerHTML = `<section class="messenger"><aside class="messenger-inbox"><header class="messenger-head"><div><h2>Messages</h2><p>Staff conversations</p></div>${myRank >= 2 ? '<button class="btn btn-lime btn-sm" id="newStaffChat">New chat</button>' : ''}</header><div class="messenger-threads">${roots.map((root) => { const last = all.filter((m) => m.id === root.id || m.parent_id === root.id).slice(-1)[0] || root; return `<button class="messenger-thread ${root.id === active?.id ? 'active' : ''}" data-open-thread="${root.id}"><span class="messenger-avatar">${esc(conversationName(root).slice(0,1).toUpperCase())}</span><span class="messenger-preview"><strong>${esc(conversationName(root))}</strong><small>${esc(person(last.sender_id))}: ${esc(last.body)}</small></span><time>${fmtDate(last.created_at, { hour:'numeric', minute:'2-digit' })}</time></button>`; }).join('') || '<div class="messenger-empty">No conversations yet.<br>Start a new chat to begin.</div>'}</div></aside><div class="messenger-chat">${active ? `<header class="messenger-head chat-head"><span class="messenger-avatar">${esc(conversationName(active).slice(0,1).toUpperCase())}</span><div><h3>${esc(conversationName(active))}</h3><p>${active.recipient_id ? 'Direct conversation' : 'Tutor announcement thread'}</p></div></header><div class="messenger-stream" id="messageStream">${thread.map((m) => `<article class="chat-bubble ${m.sender_id === me.id ? 'mine' : ''}"><strong>${esc(person(m.sender_id))}</strong><p>${esc(m.body)}</p>${m.attachment_url ? `<a href="${esc(m.attachment_url)}" target="_blank" rel="noopener">Open attachment</a>` : ''}<time>${fmtDate(m.created_at, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</time></article>`).join('')}</div><form id="staffMessageForm" class="messenger-compose"><textarea class="input" id="staffBody" placeholder="Write a messageâ€¦" required maxlength="5000" aria-label="Write a message"></textarea><div class="compose-actions"><input id="staffAttachment" type="url" class="input" placeholder="Attachment link (optional)"><input id="staffFile" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx" aria-label="Attach a file"><input type="hidden" id="staffParent" value="${active.id}"><button class="btn btn-lime" type="submit">Send</button></div></form>` : '<div class="messenger-empty welcome"><h3>Your staff inbox</h3><p>Select a conversation or start a new chat.</p></div>'}</div></section>`;
    $('panel').querySelectorAll('[data-open-thread]').forEach((button) => button.addEventListener('click', () => staffInbox(button.dataset.openThread)));
    const messageStream = $('messageStream'); if (messageStream) messageStream.scrollTop = messageStream.scrollHeight;
    $('newStaffChat')?.addEventListener('click', () => { const m = modal({ title: 'New staff message', body: `<div class="field"><label for="staffRecipient">Send to</label><select class="input" id="staffRecipient"><option value="">All tutors</option>${(tutors || []).filter((t) => t.role === 'tutor').map((t) => `<option value="${t.id}">${esc(t.full_name || t.email)}</option>`).join('')}</select></div><div class="field"><label for="newStaffBody">Message</label><textarea class="input" id="newStaffBody" maxlength="5000" required></textarea></div>` , actions: '<button class="btn btn-lime" id="sendNewStaff">Send message</button>' }); m.el.querySelector('#sendNewStaff').addEventListener('click', async () => { const body = m.el.querySelector('#newStaffBody').value.trim(), recipient_id = m.el.querySelector('#staffRecipient').value || null; if (!body) return toast('Write a message first.', 'err'); const { error: sendError } = await supabase.from('staff_messages').insert({ sender_id: me.id, recipient_id, body }); if (sendError) return toast(sendError.message, 'err'); m.close(); toast('Message sent', 'ok'); staffInbox(); }); });
    $('staffMessageForm').addEventListener('submit', async (event) => { event.preventDefault(); const body = $('staffBody').value.trim(), file = $('staffFile').files[0]; let attachment_url = $('staffAttachment').value.trim() || null; if (!body && !file) return;
      if (attachment_url && !/^https?:\/\//i.test(attachment_url)) return toast('Attachment links must begin with http:// or https://.', 'err');
      if (file) { if (file.size > 100 * 1024 * 1024) return toast('Attachment must be 100 MB or smaller.', 'err'); const path = `tutors/${me.id}/messages/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`; const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { contentType: file.type }); if (uploadError) return toast(uploadError.message, 'err'); attachment_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl; }
      const parentId = $('staffParent').value || null; const parent = parentId ? byId.get(parentId) : null; let recipient = parent?.recipient_id ? (parent.sender_id === me.id ? parent.recipient_id : parent.sender_id) : parent ? null : null;
      const row = { sender_id: me.id, recipient_id: recipient, parent_id: parentId, body: body || 'Shared an attachment', attachment_url };
      const { error: sendError } = await supabase.from('staff_messages').insert(row); if (sendError) return toast(sendError.message, 'err'); toast('Message sent', 'ok'); staffInbox();
    });
  }

  async function tutorGroups(groupId) {
    activeTutorGroupId = groupId || null;
    if (tutorGroupChannel) { supabase.removeChannel(tutorGroupChannel); tutorGroupChannel = null; }
    if (tutorGroupPresence) { clearTimeout(tutorTypingTimer); tutorGroupPresence.stop(); tutorGroupPresence = null; }
    const [courseIds, groupResult] = await Promise.all([assignedCourseIds(), supabase.from('tutor_groups').select('*').eq('owner_id', me.id).order('created_at', { ascending: false })]);
    const groups = groupResult.data || []; const { data: courses } = courseIds.length ? await supabase.from('courses').select('id,title').in('id', courseIds) : { data: [] };
    $('panel').innerHTML = `<div class="panel"><div class="tools"><div class="grow"><h2>Course discussions</h2><p class="muted">Chat with enrolled students and share assignments or course updates.</p></div><button class="btn btn-lime" id="newTutorGroup">${icon('plus', '', 16)}Create group</button></div><div class="course-chat-picker">${groups.map((g) => `<button class="btn ${g.id === groupId ? 'btn-dark' : 'btn-outline'} btn-sm" data-group="${g.id}">${esc(g.title)}</button>`).join('') || '<p class="muted">Create a group for one of your assigned courses to begin.</p>'}</div></div>`;
    $('newTutorGroup')?.addEventListener('click', () => { const m = modal({ title: 'Create course group', body: `<form id="newGroupForm"><div class="field"><label for="groupCourse">Assigned course</label><select class="input" id="groupCourse">${(courses || []).map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div><div class="field"><label for="groupTitle">Group name</label><input class="input" id="groupTitle" required maxlength="160"></div></form>`, actions: '<button class="btn btn-lime" id="createGroup">Create</button>' });
      m.el.querySelector('#createGroup').addEventListener('click', async () => { const title = m.el.querySelector('#groupTitle').value.trim(), course_id = m.el.querySelector('#groupCourse').value; if (!course_id || title.length < 2) return toast('Choose a course and enter a group name.', 'err'); const { error } = await supabase.from('tutor_groups').insert({ course_id, owner_id: me.id, title }); if (error) return toast(error.message, 'err'); m.close(); tutorGroups(); }); });
    $('panel').querySelectorAll('[data-group]').forEach((button) => button.addEventListener('click', () => tutorGroups(button.dataset.group)));
    if (!groupId) return;
    const group = groups.find((g) => g.id === groupId); if (!group) return;
    const { data: posts } = await supabase.from('tutor_group_posts').select('*').eq('group_id', group.id).order('created_at');
    const authorName = (post) => post.author_id === me.id ? 'You' : post.author_name || 'Course member';
    $('panel').insertAdjacentHTML('beforeend', `<section class="panel discussion-panel"><header class="discussion-head"><span class="messenger-avatar">${esc(group.title.slice(0,1).toUpperCase())}</span><div class="discussion-heading-copy"><h3>${esc(group.title)}</h3><p class="muted">Tutor and student chat</p><small class="group-online-count" id="tutorGroupCount">Checking members…</small></div><button class="btn btn-outline btn-sm group-info-toggle" id="tutorGroupInfoToggle" type="button" aria-expanded="false">${icon('users', '', 16)} Group info</button></header><aside class="group-info-menu" id="tutorGroupInfoMenu" hidden><div class="group-info-title"><strong>Group members</strong><button class="icon-btn" id="tutorGroupInfoClose" type="button" aria-label="Close group info">${icon('x', '', 16)}</button></div><ul class="group-member-list" id="tutorGroupMembers"><li class="muted">Loading members…</li></ul></aside><div class="discussion-stream" id="tutorChatStream">${(posts || []).map((p) => `<article class="chat-bubble discussion-bubble ${p.author_id === me.id && p.post_type === 'message' ? 'mine' : ''}" data-chat-message="${p.id}"><strong>${esc(authorName(p))}</strong><span class="badge">${p.post_type === 'assignment' ? 'Assignment' : 'Message'}</span>${p.title ? `<h4 style="margin-top:8px">${esc(p.title)}</h4>` : ''}<p>${esc(p.body)}</p>${p.attachment_url ? `<a href="${esc(p.attachment_url)}" target="_blank" rel="noopener">Open attachment</a>` : ''}<time>${fmtDate(p.created_at)}</time></article>`).join('') || '<p class="muted">No messages yet. Start the conversation.</p>'}<div class="chat-typing" id="tutorGroupTyping" aria-live="polite" hidden></div></div><form id="groupPostForm" class="tutor-chat-compose"><div class="field"><label for="groupPostType">Post type</label><select class="input" id="groupPostType"><option value="message">Message</option><option value="assignment">Assignment or project (students can react; submissions go to Assignments)</option></select></div><div class="field"><label for="groupPostTitle">Assignment heading (optional for messages)</label><input class="input" id="groupPostTitle" maxlength="160"></div><div class="field"><label for="groupPostBody">Instructions or message</label><textarea class="input" id="groupPostBody" maxlength="5000"></textarea></div><label class="check"><input id="groupPostProject" type="checkbox"> This is a project that must be tutor-checked before certificate</label><div class="field"><label for="groupPostDue">Submission deadline</label><input class="input" id="groupPostDue" type="datetime-local"></div><div class="field"><label for="groupPostLink">Media or assignment link</label><input class="input" id="groupPostLink" type="url" placeholder="https://"></div><div class="field"><label for="groupPostFile">Upload media / assignment (optional)</label><input class="input" id="groupPostFile" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"></div><button class="btn btn-lime" type="submit">Post to group</button></form></section>`);
    const tutorChatStream = $('tutorChatStream'); if (tutorChatStream) tutorChatStream.scrollTop = tutorChatStream.scrollHeight;
    let groupMembers = [], groupPresence = {};
    const paintMembers = () => renderGroupMembers(groupMembers, groupPresence, $('tutorGroupMembers'), (total, online) => { const count = $('tutorGroupCount'); if (count) count.textContent = `${online} online · ${total} members`; });
    let presenceConnection;
    presenceConnection = joinGroupPresence(supabase, group.id, me, (presence) => { if (activeTutorGroupId !== group.id || (tutorGroupPresence && tutorGroupPresence !== presenceConnection)) return; const wasOnline = Object.values(groupPresence).flat().filter((member) => member.user_id).map((member) => member.user_id).sort().join(','); const isOnline = Object.values(presence).flat().filter((member) => member.user_id).map((member) => member.user_id).sort().join(','); groupPresence = presence; paintMembers(); renderTypingIndicator($('tutorGroupTyping'), presence, me); if (wasOnline !== isOnline && !$('tutorGroupInfoMenu')?.hidden) loadGroupMembers(supabase, group.id).then(({ members }) => { if (tutorGroupPresence !== presenceConnection || activeTutorGroupId !== group.id || !members) return; groupMembers = members; paintMembers(); }); }); tutorGroupPresence = presenceConnection;
    loadGroupMembers(supabase, group.id).then(({ members, error }) => { if (activeTutorGroupId !== group.id || tutorGroupPresence !== presenceConnection) return; if (error) { $('tutorGroupMembers').innerHTML = `<li class="muted">${esc(error.message)}</li>`; return; } groupMembers = members; paintMembers(); });
    $('tutorGroupInfoToggle').addEventListener('click', () => { const menu = $('tutorGroupInfoMenu'), open = menu.hidden; menu.hidden = !open; $('tutorGroupInfoToggle').setAttribute('aria-expanded', String(open)); if (open) paintMembers(); });
    $('tutorGroupInfoClose').addEventListener('click', () => { $('tutorGroupInfoMenu').hidden = true; $('tutorGroupInfoToggle').setAttribute('aria-expanded', 'false'); });
    $('groupPostBody').addEventListener('input', () => { if ($('groupPostType').value !== 'message' || !$('groupPostBody').value.trim()) { clearTimeout(tutorTypingTimer); tutorGroupPresence.trackTyping(false); return; } clearTimeout(tutorTypingTimer); tutorGroupPresence.trackTyping(true); tutorTypingTimer = setTimeout(() => tutorGroupPresence?.trackTyping(false), 1300); });
    $('groupPostBody').addEventListener('focusout', () => { clearTimeout(tutorTypingTimer); tutorGroupPresence?.trackTyping(false); });
    $('groupPostType').addEventListener('change', () => { if ($('groupPostType').value !== 'message') { clearTimeout(tutorTypingTimer); tutorGroupPresence?.trackTyping(false); } });
    tutorGroupChannel = supabase.channel(`tutor-course-chat-${group.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tutor_group_posts', filter: `group_id=eq.${group.id}` }, async ({ new: post }) => {
      if (post.group_id !== group.id) return; const stream = $('tutorChatStream'); if (!stream || stream.querySelector(`[data-chat-message="${post.id}"]`)) return;
      const nearBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 100;
      const bubble = document.createElement('article'); bubble.className = `chat-bubble discussion-bubble ${post.author_id === me.id && post.post_type === 'message' ? 'mine' : ''}`; bubble.dataset.chatMessage = post.id;
      bubble.innerHTML = `<strong>${esc(post.author_id === me.id ? 'You' : post.author_name || 'Course member')}</strong><span class="badge">${post.post_type === 'assignment' ? 'Assignment' : 'Message'}</span>${post.title ? `<h4 style="margin-top:8px">${esc(post.title)}</h4>` : ''}<p>${esc(post.body)}</p>${post.attachment_url ? `<a href="${esc(post.attachment_url)}" target="_blank" rel="noopener">Open attachment</a>` : ''}<time>${fmtDate(post.created_at)}</time>`;
      stream.querySelector('.muted')?.remove(); stream.append(bubble); if (nearBottom) stream.scrollTop = stream.scrollHeight;
    }).subscribe();
    $('groupPostForm').addEventListener('submit', async (event) => { event.preventDefault(); clearTimeout(tutorTypingTimer); tutorGroupPresence?.trackTyping(false); const body = $('groupPostBody').value.trim(), title = $('groupPostTitle').value.trim(), file = $('groupPostFile').files[0], postType = $('groupPostType').value, isProject = $('groupPostProject').checked, dueValue = $('groupPostDue').value; let attachment_url = $('groupPostLink').value.trim() || null; if (!body && !file) return toast('Add a message or file.', 'err'); if (postType === 'assignment' && title.length < 2) return toast('Add an assignment heading.', 'err'); if (isProject && postType !== 'assignment') return toast('Projects must be posted as assignments.', 'err'); if (attachment_url && !/^https?:\/\//i.test(attachment_url)) return toast('Attachment links must begin with https:// or http://.', 'err'); if (file) { if (file.size > 100 * 1024 * 1024) return toast('Attachment must be 100 MB or smaller.', 'err'); const path = `tutors/${me.id}/groups/${group.id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`; const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { contentType: file.type }); if (uploadError) return toast(uploadError.message, 'err'); attachment_url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl; }
      if (postType === 'assignment') { const { error } = await supabase.rpc('post_tutor_group_assignment', { p_group: group.id, p_title: title, p_instructions: body, p_attachment_url: attachment_url, p_is_project: isProject, p_due_at: dueValue ? new Date(dueValue).toISOString() : null }); if (error) return toast(error.message, 'err'); toast('Assignment posted and added to student Assignments.', 'ok'); }
      else { const { error } = await supabase.from('tutor_group_posts').insert({ group_id: group.id, author_id: me.id, post_type: 'message', title: title || null, body: body || 'Shared an attachment', attachment_url }); if (error) return toast(error.message, 'err'); }
      tutorGroups(group.id); });
  }

  async function studentIdDirectory() {
    const certificateSettings = (await getSettings()).certificate || {};
    const signatureUrl = certificateSettings.signature_url || '';
    const { data: cards, error } = await supabase.from('student_id_cards').select('id,user_id,course_id,course:courses(title),card_number,issue_year,issued_at,status,revoked_reason').order('issued_at', { ascending: false });
    if (error) return void ($('panel').innerHTML = empty('Student cards unavailable', error.message));
    const ids = (cards || []).map((card) => card.user_id);
    const { data: profiles } = ids.length ? await supabase.from('profiles').select('id,full_name,email,phone,address,avatar_url').in('id', ids) : { data: [] };
    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    $('panel').innerHTML = `<div class="panel"><h2>Student ID cards</h2><div class="list">${(cards || []).map((card) => { const p = profileMap.get(card.user_id) || {}; const xml = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540"><rect width="900" height="540" rx="28" fill="#f9fbf5"/><rect width="900" height="90" rx="28" fill="#17212b"/><text x="30" y="58" fill="white" font-family="Arial" font-size="28">COURSSINS TECHNOLOGY INSTITUTE Â· STUDENT</text>${p.avatar_url ? `<image href="${xml(p.avatar_url)}" x="34" y="120" width="160" height="190" preserveAspectRatio="xMidYMid slice"/>` : '<rect x="34" y="120" width="160" height="190" fill="#d9e2e8"/>'}<text x="230" y="160" font-family="Arial" font-size="32" font-weight="700">${xml(p.full_name)}</text><text x="230" y="210" font-family="Arial" font-size="20">${xml(p.email)}</text><text x="230" y="250" font-family="Arial" font-size="20">${xml(p.phone)}</text><text x="230" y="290" font-family="Arial" font-size="20">${xml(p.address)}</text><path d="M34 380H866" stroke="#d7ded4"/><text x="34" y="435" font-family="Arial" font-size="24">${xml(card.card_number)} Â· Issued ${fmtDate(card.issued_at)} Â· ${xml(card.status.toUpperCase())}</text><text x="34" y="470" font-family="Arial" font-size="18">Course: ${xml(card.course?.title || "No course assigned")}</text>${signatureUrl ? `<image href="${xml(signatureUrl)}" x="680" y="455" width="150" height="42" preserveAspectRatio="xMidYMid meet"/>` : ""}<path d="M680 500H850" stroke="#17212b"/><text x="680" y="520" font-family="Arial" font-size="13">Abdulmannan Sulayman - Director of Studies</text></svg>`; const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); return `<div class="list-item"><div class="grow"><strong>${esc(p.full_name || 'Student')}</strong><p class="muted">${esc(p.email || '')} Â· ${esc(card.card_number)}</p><span class="badge ${card.status === 'valid' ? 'ok' : 'err'}">${card.status}</span>${card.revoked_reason ? `<p class="muted">${esc(card.revoked_reason)}</p>` : ''}</div><a class="btn btn-outline btn-sm" href="${href}" download="${esc(card.card_number)}.svg">Download image</a><button class="btn btn-ghost btn-sm" data-card-toggle="${card.id}" data-status="${card.status}">${card.status === 'valid' ? 'Revoke' : 'Restore'}</button></div>`; }).join('') || '<p class="muted">No student cards yet.</p>'}</div></div>`;
    const { data: staffCards } = await supabase.from('staff_id_cards').select('id,user_id,card_number,issue_year,issued_at,status,revoked_reason').order('issued_at', { ascending: false });
    const staffIds = (staffCards || []).map((card) => card.user_id); const { data: staffProfiles } = staffIds.length ? await supabase.from('profiles').select('id,full_name,email,phone,address,avatar_url,role').in('id', staffIds) : { data: [] };
    const staffMap = new Map((staffProfiles || []).map((profile) => [profile.id, profile]));
    $('panel').insertAdjacentHTML('beforeend', `<div class="panel"><h2>Staff ID cards</h2><div class="list">${(staffCards || []).map((card) => { const p = staffMap.get(card.user_id) || {}; const xml = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]); const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540"><rect width="900" height="540" rx="28" fill="#f9fbf5"/><rect width="900" height="90" rx="28" fill="#17212b"/><text x="30" y="58" fill="white" font-family="Arial" font-size="28">COURSSINS TECHNOLOGY INSTITUTE Â· STAFF</text>${p.avatar_url ? `<image href="${xml(p.avatar_url)}" x="34" y="120" width="160" height="190" preserveAspectRatio="xMidYMid slice"/>` : '<rect x="34" y="120" width="160" height="190" fill="#d9e2e8"/>'}<text x="230" y="160" font-family="Arial" font-size="32" font-weight="700">${xml(p.full_name)}</text><text x="230" y="210" font-family="Arial" font-size="20">${xml(p.role)}</text><text x="230" y="250" font-family="Arial" font-size="20">${xml(p.email)}</text><text x="230" y="290" font-family="Arial" font-size="20">${xml(p.phone)}</text><text x="230" y="330" font-family="Arial" font-size="20">${xml(p.address)}</text><path d="M34 380H866" stroke="#d7ded4"/><text x="34" y="435" font-family="Arial" font-size="24">${xml(card.card_number)} Â· ${xml(card.issue_year)} Â· ${xml(card.status.toUpperCase())}</text><text x="34" y="470" font-family="Arial" font-size="18">Role: ${xml(p.role)}</text>${signatureUrl ? `<image href="${xml(signatureUrl)}" x="680" y="455" width="150" height="42" preserveAspectRatio="xMidYMid meet"/>` : ""}<path d="M680 500H850" stroke="#17212b"/><text x="680" y="520" font-family="Arial" font-size="13">Abdulmannan Sulayman - Director of Studies</text></svg>`; const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })); return `<div class="list-item"><div class="grow"><strong>${esc(p.full_name || 'Staff')}</strong><p class="muted">${esc(p.role || '')} Â· ${esc(card.card_number)}</p><span class="badge ${card.status === 'valid' ? 'ok' : 'err'}">${card.status}</span></div><a class="btn btn-outline btn-sm" href="${href}" download="${esc(card.card_number)}.svg">Download image</a><button class="btn btn-ghost btn-sm" data-staff-card-toggle="${card.id}" data-status="${card.status}">${card.status === 'valid' ? 'Revoke' : 'Restore'}</button></div>`; }).join('') || '<p class="muted">No staff cards yet.</p>'}</div></div>`);
    $('panel').querySelectorAll('[data-card-toggle]').forEach((button) => button.addEventListener('click', async () => { const status = button.dataset.status === 'valid' ? 'revoked' : 'valid'; const revoked_reason = status === 'revoked' ? prompt('Reason for revoking this card?') || 'Revoked by administrator' : null; const { error: updateError } = await supabase.from('student_id_cards').update({ status, revoked_reason, revoked_at: status === 'revoked' ? new Date().toISOString() : null }).eq('id', button.dataset.cardToggle); if (updateError) return toast(updateError.message, 'err'); studentIdDirectory(); }));
    $('panel').querySelectorAll('[data-staff-card-toggle]').forEach((button) => button.addEventListener('click', async () => { const status = button.dataset.status === 'valid' ? 'revoked' : 'valid'; const revoked_reason = status === 'revoked' ? prompt('Reason for revoking this card?') || 'Revoked by administrator' : null; const { error: updateError } = await supabase.from('staff_id_cards').update({ status, revoked_reason }).eq('id', button.dataset.staffCardToggle); if (updateError) return toast(updateError.message, 'err'); studentIdDirectory(); }));
  }

  const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o) ?? '';
  const put = (o, p, v) => { const ks = p.split('.'); ks.slice(0, -1).reduce((a, k) => (a[k] ||= {}), o)[ks.at(-1)] = v; };
  async function site() {
    const S = await getSettings();
    $('panel').innerHTML = `<p class="muted" style="margin-bottom:16px;max-width:70ch">Edit what visitors see on the homepage, footer and certificates. Changes are live as soon as you save.</p>` + SITE_SPEC.map((sec) => {
      const cur = S[sec.key] || (sec.key === 'certificate' ? { organisation: 'Courssins Technology Institute', signatory_name: 'Abdulmannan Sulayman', signatory: 'Director of Studies' } : {});
      let inner = '';
      if (sec.rows) inner = `<div class="table-wrap"><table class="data"><thead><tr><th>Number</th><th>Suffix</th><th>Label</th></tr></thead><tbody>${[0, 1, 2, 3].map((i) => `<tr>${sec.rows.map((k) => `<td><input class="input" style="height:44px" data-k="${i}.${k}" value="${esc(cur[i]?.[k] ?? '')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      else inner = sec.fields.map(([k, l, t]) => `<div class="field"><label>${l}</label>${t === 'textarea' ? `<textarea class="input" data-k="${k}">${esc(get(cur, k))}</textarea>` : t === 'image' ? `<div style="display:flex;gap:8px"><input class="input" data-k="${k}" value="${esc(get(cur, k))}" placeholder="Upload a signature image" readonly><label class="btn btn-ghost" style="flex:none;height:54px">${icon('upload', '', 18)}Upload<input type="file" hidden data-setting-image="${k}" accept="image/*"></label></div>` : `<input class="input" data-k="${k}" value="${esc(get(cur, k))}">`}</div>`).join('') + (sec.json ? `<div class="field"><label>Cards (JSON)</label><textarea class="input" data-json="${sec.json}" style="min-height:220px;font-family:monospace;font-size:.85rem">${esc(JSON.stringify(cur[sec.json] || [], null, 2))}</textarea><span class="hint">Each card: icon, title, text${sec.key === 'why' ? ', href, cta' : ''}. Set "highlight": true or "active": true on the card that should be lime.</span></div>` : '');
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

    $('panel').querySelectorAll('[data-setting-image]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) return toast('Signature image must be 10 MB or smaller.', 'err');
      const path = `certificate/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false, contentType: file.type });
      if (error) return toast(`Signature upload failed: ${error.message}`, 'err');
      input.closest('.field').querySelector('[data-k]').value = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
      toast('Signature image uploaded', 'ok');
    }));
    $('panel').querySelectorAll('form[data-sec]').forEach((f) => f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const sec = SITE_SPEC.find((s) => s.key === f.dataset.sec); let val;
      if (sec.rows) { val = []; [0, 1, 2, 3].forEach((i) => { const o = {}; sec.rows.forEach((k) => (o[k] = f.querySelector(`[data-k="${i}.${k}"]`).value.trim())); o.value = Number(o.value) || 0; if (o.label) val.push(o); }); }
      else { val = { ...(S[sec.key] || {}) }; f.querySelectorAll('[data-k]').forEach((i) => put(val, i.dataset.k, i.value.trim())); const j = f.querySelector('[data-json]'); if (j) { try { val[j.dataset.json] = JSON.parse(j.value || '[]'); } catch { return toast('Cards JSON is not valid.', 'err'); } } }
      const btn = f.querySelector('button'); setBusy(btn, true, 'Saving');
      const { error } = await supabase.from('settings').upsert({ key: sec.key, value: val, updated_at: new Date().toISOString() }); setBusy(btn, false);
      error ? toast(error.message, 'err') : toast('Saved', 'ok');
    }));
  }

  async function tutorProfile() {
    const [{ data: tutor, error }, { data: staffProfile }] = await Promise.all([supabase.from('tutors').select('*').eq('user_id', me.id).maybeSingle(), supabase.from('profiles').select('address').eq('id', me.id).maybeSingle()]);
    if (error) { $('panel').innerHTML = empty('Could not load profile', error.message); return; }
    if (!tutor) { $('panel').innerHTML = empty('Tutor profile not linked', 'Ask a Super Admin to link your login to a tutor profile.'); return; }
    const socials = tutor.socials || {};
    $('panel').innerHTML = `<form class="panel" id="tutorProfileForm" style="max-width:760px"><h2>My tutor profile</h2>
      <div class="field"><label for="tpName">Full name</label><input class="input" id="tpName" maxlength="120" value="${esc(tutor.full_name || '')}" required></div>
      <div class="row-2"><div class="field"><label for="tpTitle">Professional title</label><input class="input" id="tpTitle" value="${esc(tutor.title || '')}"></div><div class="field"><label for="tpSpecialization">Specialization</label><input class="input" id="tpSpecialization" value="${esc(tutor.specialization || '')}"></div></div>
      <div class="field"><label for="tpBio">Biography</label><textarea class="input" id="tpBio" maxlength="4000">${esc(tutor.bio || '')}</textarea></div>
      <div class="field"><label for="tpExperience">Experience</label><textarea class="input" id="tpExperience" maxlength="3000">${esc(tutor.experience || '')}</textarea></div>
      <div class="row-2"><div class="field"><label for="tpQualifications">Qualifications, one per line</label><textarea class="input" id="tpQualifications">${esc(arr(tutor.qualifications).join('\n'))}</textarea></div><div class="field"><label for="tpExpertise">Areas of expertise, one per line</label><textarea class="input" id="tpExpertise">${esc(arr(tutor.expertise).join('\n'))}</textarea></div></div>
      <div class="row-2"><div class="field"><label for="tpEmail">Public contact email</label><input class="input" id="tpEmail" type="email" value="${esc(tutor.email || '')}"></div><div class="field"><label for="tpImage">Profile photo</label><div style="display:flex;gap:8px"><input class="input" id="tpImage" value="${esc(tutor.image_url || '')}" readonly><label class="btn btn-ghost" style="height:54px;flex:none">${icon('upload', '', 18)}Upload<input id="tpImageUpload" type="file" accept="image/*" hidden></label></div></div></div>
      <div class="row-2"><div class="field"><label for="tpPhone">Staff ID phone</label><input class="input" id="tpPhone" maxlength="40" value="${esc(staffProfile?.phone || '')}"></div><div class="field"><label for="tpAddress">Staff ID address</label><input class="input" id="tpAddress" maxlength="240" value="${esc(staffProfile?.address || '')}"></div></div>
      <div class="row-2"><div class="field"><label for="tpInstagram">Instagram URL</label><input class="input" id="tpInstagram" type="url" value="${esc(socials.instagram || '')}"></div><div class="field"><label for="tpLinkedin">LinkedIn URL</label><input class="input" id="tpLinkedin" type="url" value="${esc(socials.linkedin || '')}"></div></div>
      <div class="row-2"><div class="field"><label for="tpX">X URL</label><input class="input" id="tpX" type="url" value="${esc(socials.x || '')}"></div><div class="field"><label for="tpFacebook">Facebook URL</label><input class="input" id="tpFacebook" type="url" value="${esc(socials.facebook || '')}"></div></div>
      <p class="hint">A Super Admin controls whether your profile is published publicly.</p><button class="btn btn-lime" type="submit">Save profile</button></form>`;
    $('tpImageUpload').addEventListener('change', async (event) => {
      const file = event.currentTarget.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) return toast('Profile image must be 10 MB or smaller.', 'err');
      const path = `tutors/${me.id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) return toast(`Profile image upload failed: ${uploadError.message}`, 'err');
      $('tpImage').value = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
      toast('Profile photo uploaded', 'ok');
    });
    $('tutorProfileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const validUrl = (value) => !value || /^https?:\/\/[^\s]+$/i.test(value);
      const socialEntries = [['instagram', 'tpInstagram'], ['linkedin', 'tpLinkedin'], ['x', 'tpX'], ['facebook', 'tpFacebook']].map(([key, id]) => [key, $ (id).value.trim()]).filter(([, value]) => value);
      if (socialEntries.some(([, value]) => !validUrl(value))) return toast('Social links must start with http:// or https://.', 'err');
      const name = $('tpName').value.trim();
      if (name.length < 2) return toast('Enter your name.', 'err');
      const button = event.currentTarget.querySelector('button[type="submit"]');
      setBusy(button, true, 'Saving');
      const updates = {
        full_name: name,
        title: $('tpTitle').value.trim(),
        specialization: $('tpSpecialization').value.trim(),
        bio: $('tpBio').value.trim(),
        experience: $('tpExperience').value.trim(),
        qualifications: $('tpQualifications').value.split('\n').map((value) => value.trim()).filter(Boolean),
        expertise: $('tpExpertise').value.split('\n').map((value) => value.trim()).filter(Boolean),
        email: $('tpEmail').value.trim() || null,
        image_url: $('tpImage').value.trim() || null,
        socials: Object.fromEntries(socialEntries),
      };
      const { error: saveError } = await supabase.from('tutors').update(updates).eq('id', tutor.id).eq('user_id', me.id);
      setBusy(button, false);
      if (saveError) return toast('Profile could not be saved.', 'err');
      const { error: addressError } = await supabase.from('profiles').update({ phone: $('tpPhone').value.trim(), address: $('tpAddress').value.trim() }).eq('id', me.id);
      if (addressError) return toast('Tutor profile saved, but the ID card address could not be updated.', 'err');
      Object.keys(refCache).forEach((key) => delete refCache[key]);
      toast('Tutor profile saved', 'ok');
    });
  }

  async function staffIdCard() {
    const certificateSettings = (await getSettings()).certificate || {};
    const signatureUrl = certificateSettings.signature_url || '';
    const [{ data: card, error }, { data: profile }, { data: tutor }] = await Promise.all([
      supabase.rpc('get_or_create_staff_id_card'),
      supabase.from('profiles').select('full_name,email,phone,address,role,avatar_url').eq('id', me.id).single(),
      supabase.from('tutors').select('image_url').eq('user_id', me.id).maybeSingle(),
    ]);
    if (error || !card || !profile) { $('panel').innerHTML = empty('Staff ID unavailable', error?.message || 'We could not load your staff ID.'); return; }
    const photo = profile.avatar_url || tutor?.image_url;
    const staffSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="900" height="560" rx="28" fill="#f9fbf5"/><rect width="900" height="95" rx="28" fill="#17212b"/><text x="30" y="60" fill="white" font-family="Arial" font-size="29">COURSSINS TECHNOLOGY INSTITUTE Â· STAFF</text>${photo ? `<image href="${esc(photo)}" x="34" y="120" width="170" height="200" preserveAspectRatio="xMidYMid slice"/>` : '<rect x="34" y="120" width="170" height="200" fill="#d9e2e8"/>'}<text x="240" y="155" font-family="Arial" font-size="32" font-weight="700">${esc(profile.full_name)}</text><text x="240" y="205" font-family="Arial" font-size="20">${esc(profile.role.replace('_', ' '))}</text><text x="240" y="250" font-family="Arial" font-size="20">${esc(profile.email)}</text><text x="240" y="290" font-family="Arial" font-size="20">${esc(profile.phone)}</text><text x="240" y="330" font-family="Arial" font-size="20">${esc(profile.address)}</text><path d="M34 390H866" stroke="#d7ded4"/><text x="34" y="445" font-family="Arial" font-size="24">${esc(card.card_number)} Â· ${esc(String(card.issue_year))} Â· ${esc(card.status.toUpperCase())}</text>${signatureUrl ? `<image href="${esc(signatureUrl)}" x="680" y="455" width="150" height="42" preserveAspectRatio="xMidYMid meet"/>` : ''}<path d="M680 500H850" stroke="#17212b"/><text x="680" y="520" font-family="Arial" font-size="13">Abdulmannan Sulayman, Director of Studies</text></svg>`;
    const staffSvgUrl = URL.createObjectURL(new Blob([staffSvg], { type: 'image/svg+xml;charset=utf-8' }));
    $('panel').innerHTML = `<div class="panel" style="max-width:760px"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><div><span class="eyebrow">Courssins Technology Institute</span><h2 style="margin-top:8px">Staff identity card</h2></div><span class="badge ${card.status === 'valid' ? 'ok' : 'err'}">${card.status}</span></div><article class="panel" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;background:var(--paper);margin-top:20px"><div style="width:128px;height:156px;border-radius:var(--r-md);overflow:hidden;background:var(--soft);display:grid;place-items:center;flex:none">${photo ? `<img src="${esc(photo)}" alt="Staff photo" style="width:100%;height:100%;object-fit:cover">` : icon('user', '', 42)}</div><div class="grow"><p class="muted" style="font-size:.82rem;letter-spacing:.1em;text-transform:uppercase">${esc(profile.role.replace('_', ' '))}</p><h2 style="margin:4px 0 14px">${esc(profile.full_name || 'Staff member')}</h2><ul class="facts" style="margin:0"><li>${icon('mail')}<span>${esc(profile.email || 'No email')}</span></li><li>${icon('phone')}<span>${esc(profile.phone || 'No phone')}</span></li><li>${icon('pin')}<span>${esc(profile.address || 'No address')}</span></li></ul></div><div style="width:100%;border-top:1px solid var(--line);padding-top:12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><span><strong>${esc(card.card_number)}</strong><br><small>Staff ID</small></span><span style="text-align:right"><strong>${esc(String(card.issue_year))}</strong><br><small>Year issued</small></span></div></article>${card.status === 'revoked' ? `<div class="alert err" style="margin-top:16px">This staff ID card has been revoked${card.revoked_reason ? `: ${esc(card.revoked_reason)}` : '.'} Contact an administrator for help.</div>` : ''}<form class="panel" id="staffCardProfile" style="margin-top:16px"><h3>Card contact details</h3><div class="row-2"><div class="field"><label for="staffCardPhone">Phone</label><input class="input" id="staffCardPhone" maxlength="40" value="${esc(profile.phone || '')}"></div><div class="field"><label for="staffCardPhoto">Passport or profile image</label><div style="display:flex;gap:8px"><input class="input" id="staffCardPhoto" readonly value="${esc(profile.avatar_url || '')}"><label class="btn btn-ghost" style="height:54px;flex:none">${icon('upload', '', 16)}Upload<input id="staffCardPhotoUpload" type="file" accept="image/*" hidden></label></div></div></div><div class="field"><label for="staffCardAddress">Address</label><input class="input" id="staffCardAddress" maxlength="240" value="${esc(profile.address || '')}"></div><button class="btn btn-dark" type="submit">Save ID card details</button></form><button class="btn btn-outline" style="margin-top:16px" type="button" onclick="window.print()">Print ID card</button> <a class="btn btn-lime" href="${staffSvgUrl}" download="${esc(card.card_number)}.svg">Download ID image</a></div>`;
    $('staffCardPhotoUpload').addEventListener('change', async (event) => {
      const file = event.currentTarget.files[0]; if (!file) return;
      if (file.size > 10 * 1024 * 1024) return toast('Profile image must be 10 MB or smaller.', 'err');
      const folder = me.role === T ? `tutors/${me.id}` : `staff/${me.id}`;
      const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) return toast(`Profile image upload failed: ${uploadError.message}`, 'err');
      $('staffCardPhoto').value = supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
    });
    $('staffCardProfile').addEventListener('submit', async (event) => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); setBusy(button, true, 'Saving');
      const { error: saveError } = await supabase.from('profiles').update({ phone: $('staffCardPhone').value.trim(), address: $('staffCardAddress').value.trim(), avatar_url: $('staffCardPhoto').value.trim() || null }).eq('id', me.id);
      setBusy(button, false); if (saveError) return toast('ID card details could not be saved.', 'err');
      toast('ID card details saved', 'ok'); staffIdCard();
    });
  }

  async function courseBuilder(courseId) {
    $('panel').innerHTML = '<div class="card skeleton" style="min-height:260px"></div>';
    const { data: courses, error } = await supabase.from('courses').select('id,title,lessons_start_at').order('sort_order');
    if (error) { $('panel').innerHTML = empty('Could not load courses', error.message); return; }
    if (!courses?.length) { $('panel').innerHTML = empty('No courses assigned', 'Create a course or ask an admin to assign one to you.'); return; }
    const selectedCourse = courseId || builderCourseId || courses[0].id;
    if (!courses.some((course) => course.id === selectedCourse)) return courseBuilder(courses[0].id);
    builderCourseId = selectedCourse;
    const [{ data: modules }, { data: lessons }, { data: resources }] = await Promise.all([
      supabase.from('course_modules').select('*').eq('course_id', selectedCourse).order('position'),
      supabase.from('lessons').select('*').eq('course_id', selectedCourse).order('position'),
      supabase.from('course_resources').select('id,title,resource_type,published').eq('course_id', selectedCourse).order('created_at', { ascending: false }),
    ]);
    const moduleRows = modules || [];
    const lessonRows = lessons || [];
    const resourceRows = resources || [];
    $('panel').innerHTML = `<div class="tools"><label class="label" for="builderCourse">Course</label><select class="input" id="builderCourse" style="max-width:460px">${courses.map((course) => `<option value="${course.id}" ${course.id === selectedCourse ? 'selected' : ''}>${esc(course.title)}</option>`).join('')}</select><span class="grow"></span><button class="btn btn-lime btn-sm" id="addModule">${icon('plus', '', 16)}Add module</button></div>
      <div class="panel"><div class="section-head"><div><h2>${esc(courses.find((course) => course.id === selectedCourse)?.title || '')}</h2><p class="muted">${moduleRows.length} modules Â· ${lessonRows.length} sections Â· ${resourceRows.length} resources</p></div><button class="btn btn-dark btn-sm" id="addResource">${icon('upload', '', 16)}Upload resource</button></div>
      ${moduleRows.map((module) => {
        const moduleLessons = lessonRows.filter((lesson) => lesson.module_id === module.id);
        return `<section class="panel"><div class="tools"><div class="grow"><h3>Module ${module.position}: ${esc(module.title)}</h3><p class="muted">${esc(module.summary || '')}</p></div><button class="btn btn-ghost btn-sm" data-edit-module="${module.id}">Edit</button><button class="btn btn-outline btn-sm" data-auto-quiz="${module.id}">Generate quiz draft</button><button class="btn btn-lime btn-sm" data-add-lesson="${module.id}">${icon('plus', '', 16)}Add section</button></div>
          ${moduleLessons.length ? `<div class="list">${moduleLessons.map((lesson) => `<div class="list-item"><div class="grow"><strong>${esc(lesson.title)}</strong><p class="muted">${esc(lesson.duration_min ? `${lesson.duration_min} min` : lesson.video_url ? 'Video attached' : 'Lesson notes')}</p></div><button class="btn btn-ghost btn-sm" data-edit-lesson="${lesson.id}">Edit section</button></div>`).join('')}</div>` : '<p class="muted">No sections yet. Add your first lesson section.</p>'}</section>`;
      }).join('') || empty('No modules yet', 'Add a module to begin building this course.')}
      <section class="panel"><div class="tools"><div class="grow"><h3>Learning resources</h3><p class="muted">Private files are available only to enrolled students and assigned tutors.</p></div><button class="btn btn-dark btn-sm" data-v="resources">Manage resources</button></div>${resourceRows.slice(0, 5).map((resource) => `<p class="hint">${esc(resource.title)} Â· ${esc(resource.resource_type)} Â· ${resource.published ? 'Published' : 'Draft'}</p>`).join('')}</section>
      <div class="btn-row"><button class="btn btn-outline btn-sm" data-v="assignments">Manage assignments</button><button class="btn btn-outline btn-sm" data-v="students">View students</button></div></div>`;

    $('builderCourse').insertAdjacentHTML('afterend', `<label class="label" for="builderStartDate">Lessons start</label><input class="input" id="builderStartDate" type="datetime-local" value="${toLocal(courses.find((course) => course.id === selectedCourse)?.lessons_start_at || '')}" style="max-width:250px"><button class="btn btn-dark btn-sm" id="saveStartDate">Save schedule</button>`);
    $('builderCourse').addEventListener('change', (event) => courseBuilder(event.currentTarget.value));
    $('saveStartDate').addEventListener('click', async (event) => {
      const raw = $('builderStartDate').value;
      const lessons_start_at = raw ? new Date(raw).toISOString() : null;
      setBusy(event.currentTarget, true, 'Saving');
      const { error: scheduleError } = await supabase.from('courses').update({ lessons_start_at }).eq('id', selectedCourse);
      setBusy(event.currentTarget, false);
      if (scheduleError) return toast(scheduleError.message, 'err');
      toast('Course schedule saved. Enrolled students have been notified.', 'ok');
      courseBuilder(selectedCourse);
    });
    $('addModule').addEventListener('click', () => {
      const formModal = modal({ title: 'Add module', body: '<form id="builderModuleForm"><div class="field"><label for="bmTitle">Module title</label><input class="input" id="bmTitle" required maxlength="160"></div><div class="field"><label for="bmSummary">Module description</label><textarea class="input" id="bmSummary" maxlength="1000"></textarea></div><div class="field"><label for="bmTopics">Section titles, one per line</label><textarea class="input" id="bmTopics" placeholder="Introduction\nGetting started\nBasic concepts"></textarea><span class="hint">Each line becomes a lesson section that you can edit later.</span></div></form>', actions: '<button class="btn btn-lime" id="saveModule">Create module and sections</button>' });
      formModal.el.querySelector('#saveModule').addEventListener('click', async (event) => {
        const title = formModal.el.querySelector('#bmTitle').value.trim();
        if (!title) return toast('Enter a module title.', 'err');
        const topics = formModal.el.querySelector('#bmTopics').value.split('\n').map((value) => value.trim()).filter(Boolean);
        setBusy(event.currentTarget, true, 'Creating');
        const position = moduleRows.reduce((max, module) => Math.max(max, Number(module.position) || 0), 0) + 1;
        const { data: created, error: createError } = await supabase.from('course_modules').insert({ course_id: selectedCourse, title, summary: formModal.el.querySelector('#bmSummary').value.trim(), topics, position }).select('id').single();
        if (createError) { setBusy(event.currentTarget, false); return toast(createError.message, 'err'); }
        if (topics.length) {
          const newLessons = topics.map((lessonTitle, index) => ({ course_id: selectedCourse, module_id: created.id, title: lessonTitle, content: '', position: position * 10 + index }));
          const { error: lessonError } = await supabase.from('lessons').insert(newLessons);
          if (lessonError) { setBusy(event.currentTarget, false); formModal.close(); await courseBuilder(selectedCourse); return toast(`Module created; sections need retrying: ${lessonError.message}`, 'err'); }
        }
        formModal.close(); toast('Module created', 'ok'); courseBuilder(selectedCourse);
      });
    });
    $('panel').querySelectorAll('[data-edit-module]').forEach((button) => button.addEventListener('click', () => form('modules', moduleRows.find((module) => module.id === button.dataset.editModule))));
    $('panel').querySelectorAll('[data-edit-lesson]').forEach((button) => button.addEventListener('click', () => form('lessons', lessonRows.find((lesson) => lesson.id === button.dataset.editLesson))));
    $('panel').querySelectorAll('[data-auto-quiz]').forEach((button) => button.addEventListener('click', async () => {
      const module = moduleRows.find((item) => item.id === button.dataset.autoQuiz); const sourceLessons = lessonRows.filter((lesson) => lesson.module_id === module.id);
      if (!sourceLessons.length) return toast('Add lesson sections before generating a quiz.', 'err');
      const statements = sourceLessons.flatMap((lesson) => String(lesson.content || '').split(/[.!?\n]+/).map((part) => part.trim()).filter((part) => part.length >= 12).map((part) => `${lesson.title}: ${part}`));
      const pool = [...new Set([...statements, ...sourceLessons.map((lesson) => `The section ${lesson.title} is included in this module.`)])];
      while (pool.length < 7) pool.push(`Review the key learning points in ${module.title} and its lesson sections.`);
      if (pool.length < 7) return toast('Add more lesson notes so the draft has enough source material.', 'err');
      const m = modal({ title: 'Generate quiz draft', body: `<p>This creates seven draft questions from this moduleâ€™s lesson notes and section titles. Review and edit every question and answer before publishing.</p><div class="alert info">Generated quizzes start unpublished and use a 50% pass mark with a 13-minute timer.</div>`, actions: '<button class="btn btn-lime" id="makeAutoQuiz">Generate draft</button>' });
      m.el.querySelector('#makeAutoQuiz').addEventListener('click', async (event) => { setBusy(event.currentTarget, true, 'Generating'); const { data: exam, error: examError } = await supabase.from('exams').insert({ course_id: selectedCourse, module_id: module.id, is_final: false, title: `Module ${module.position}: ${module.title} Quiz`, instructions: 'Auto-generated draft. Tutor must review and edit the questions and answers before publishing.', duration_min: 13, pass_mark: 50, published: false }).select('id').single(); if (examError) { setBusy(event.currentTarget, false); return toast(examError.message, 'err'); }
        const rows = Array.from({ length: 7 }, (_, index) => { const answer = pool[index % pool.length]; const distractors = pool.filter((item) => item !== answer).slice(index % Math.max(pool.length - 3, 1), index % Math.max(pool.length - 3, 1) + 3); while (distractors.length < 3) distractors.push(`Review another section in ${module.title}.`); return { exam_id: exam.id, question: `Which learning point is covered in this module? (Draft ${index + 1})`, options: [answer, ...distractors.slice(0, 3)], correct_index: 0, position: index + 1 }; });
        const { error: questionError } = await supabase.from('exam_questions').insert(rows); if (questionError) { await supabase.from('exams').delete().eq('id', exam.id); setBusy(event.currentTarget, false); return toast(questionError.message, 'err'); } m.close(); toast('Unpublished 7-question draft created; review it in Quizzes and Questions.', 'ok');
      });
    }));
    $('panel').querySelectorAll('[data-add-lesson]').forEach((button) => button.addEventListener('click', () => {
      const module = moduleRows.find((item) => item.id === button.dataset.addLesson);
      const formModal = modal({ title: `Add section to ${module.title}`, body: '<form id="builderLessonForm"><div class="field"><label for="blTitle">Section title</label><input class="input" id="blTitle" required maxlength="160"></div><div class="field"><label for="blNotes">Lesson notes</label><textarea class="input" id="blNotes" maxlength="12000"></textarea></div><div class="field"><label for="blVideo">Video URL (optional)</label><input class="input" id="blVideo" type="url" placeholder="https://"></div><div class="field"><label for="blVideoFile">Or upload video from this device (up to 500 MB)</label><input class="input" id="blVideoFile" type="file" accept="video/*"></div><div class="field"><label for="blDuration">Duration in minutes</label><input class="input" id="blDuration" type="number" min="0"></div><label class="check"><input type="checkbox" id="blPreview"> Free preview</label></form>', actions: '<button class="btn btn-lime" id="saveLesson">Add section</button>' });
      formModal.el.querySelector('#saveLesson').addEventListener('click', async (event) => {
        const title = formModal.el.querySelector('#blTitle').value.trim();
        const video = formModal.el.querySelector('#blVideo').value.trim();
        const videoFile = formModal.el.querySelector('#blVideoFile').files[0];
        if (!title) return toast('Enter a section title.', 'err');
        if (video && !/^https?:\/\//i.test(video)) return toast('Video URLs must start with https:// or http://.', 'err');
        if (video && videoFile) return toast('Choose either a video URL or upload a video file.', 'err');
        if (videoFile && (!videoFile.type.startsWith('video/') || videoFile.size > 500 * 1024 * 1024)) return toast('Choose a video file up to 500 MB.', 'err');
        setBusy(event.currentTarget, true, 'Saving');
        const position = lessonRows.filter((lesson) => lesson.module_id === module.id).reduce((max, lesson) => Math.max(max, Number(lesson.position) || 0), module.position * 10 - 1) + 1;
        let videoPath = null;
        if (videoFile) { videoPath = `${selectedCourse}/${Date.now()}-${videoFile.name.replace(/[^a-z0-9._-]/gi, '_')}`; const { error: uploadError } = await supabase.storage.from('course-materials').upload(videoPath, videoFile, { upsert: false, contentType: videoFile.type }); if (uploadError) { setBusy(event.currentTarget, false); return toast(uploadError.message, 'err'); } }
        const { error: lessonError } = await supabase.from('lessons').insert({ course_id: selectedCourse, module_id: module.id, title, content: formModal.el.querySelector('#blNotes').value.trim(), video_url: video || null, video_path: videoPath, duration_min: Number(formModal.el.querySelector('#blDuration').value) || null, is_preview: formModal.el.querySelector('#blPreview').checked, position });
        if (lessonError && videoPath) await supabase.storage.from('course-materials').remove([videoPath]);
        if (lessonError) { setBusy(event.currentTarget, false); return toast(lessonError.message, 'err'); }
        formModal.close(); toast('Section added', 'ok'); courseBuilder(selectedCourse);
      });
    }));
    $('addResource').addEventListener('click', () => {
      const formModal = modal({ title: 'Upload learning resource', body: `<form id="builderResourceForm"><div class="field"><label for="brTitle">Resource title</label><input class="input" id="brTitle" required maxlength="160"></div><div class="field"><label for="brModule">Module</label><select class="input" id="brModule"><option value="">All unlocked modules</option>${moduleRows.map((module) => `<option value="${module.id}">${esc(module.title)}</option>`).join('')}</select></div><div class="field"><label for="brType">Type</label><select class="input" id="brType"><option value="video">Video</option><option value="pdf">PDF</option><option value="note">Notes</option><option value="assignment">Assignment file</option></select></div><div class="field"><label for="brDescription">Description or instructions</label><textarea class="input" id="brDescription" maxlength="2000"></textarea></div><div class="field"><label for="brFile">File (up to 50 MB)</label><input class="input" id="brFile" type="file" accept="video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"></div><div class="field"><label for="brUrl">Or external HTTP(S) URL</label><input class="input" id="brUrl" type="url" placeholder="https://"></div></form>`, actions: '<button class="btn btn-lime" id="saveResource">Save resource</button>' });
      formModal.el.querySelector('#saveResource').addEventListener('click', async (event) => {
        const title = formModal.el.querySelector('#brTitle').value.trim();
        const file = formModal.el.querySelector('#brFile').files[0];
        const external = formModal.el.querySelector('#brUrl').value.trim();
        if (!title || (!file && !external)) return toast('Enter a title and choose a file or external URL.', 'err');
        if (external && !/^https?:\/\//i.test(external)) return toast('External URLs must start with https:// or http://.', 'err');
        if (file && file.size > 50 * 1024 * 1024) return toast('Resource must be 50 MB or smaller.', 'err');
        setBusy(event.currentTarget, true, 'Uploading');
        let objectPath = null;
        if (file) {
          objectPath = `${selectedCourse}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '_')}`;
          const { error: uploadError } = await supabase.storage.from('course-materials').upload(objectPath, file, { upsert: false, contentType: file.type });
          if (uploadError) { setBusy(event.currentTarget, false); return toast(uploadError.message, 'err'); }
        }
        const { error: saveError } = await supabase.from('course_resources').insert({ course_id: selectedCourse, module_id: formModal.el.querySelector('#brModule').value || null, title, resource_type: formModal.el.querySelector('#brType').value, description: formModal.el.querySelector('#brDescription').value.trim() || null, object_path: objectPath, external_url: external || null, published: true });
        if (saveError) {
          if (objectPath) await supabase.storage.from('course-materials').remove([objectPath]);
          setBusy(event.currentTarget, false); return toast(saveError.message, 'err');
        }
        formModal.close(); toast('Resource uploaded', 'ok'); courseBuilder(selectedCourse);
      });
    });
  }

  async function go(v) {
    if (tutorGroupChannel && v !== 'tutor-groups') { supabase.removeChannel(tutorGroupChannel); tutorGroupChannel = null; }
    if (tutorGroupPresence && v !== 'tutor-groups') { clearTimeout(tutorTypingTimer); tutorGroupPresence.stop(); tutorGroupPresence = null; activeTutorGroupId = null; }
    v = v || 'dash'; const profileView = v === 'tutor-profile' && me.role === T; const cardView = v === 'staff-id'; const builderView = v === 'builder' && myRank >= 1; const inboxView = v === 'staff-inbox'; const groupsView = v === 'tutor-groups' && me.role === T; const studentCardsView = v === 'student-id-directory' && myRank >= 2; if (v !== 'dash' && v !== 'site' && !profileView && !cardView && !builderView && !inboxView && !groupsView && !studentCardsView && !allowed.find(([k]) => k === v)) v = 'dash'; if (v === 'site' && myRank < 3) v = 'dash';
    activeAdminView = v;
    document.querySelectorAll('[data-v]').forEach((b) => b.classList?.contains('side-link') && b.setAttribute('aria-current', b.dataset.v === v));
    $('panelTitle').textContent = v === 'dash' ? 'Overview' : v === 'site' ? 'Website content' : profileView ? 'My tutor profile' : cardView ? 'My staff ID' : builderView ? 'Course builder' : inboxView ? 'Staff inbox' : groupsView ? 'Course discussions' : studentCardsView ? 'Student ID cards' : E[v].t; toggle(false);
    history.replaceState(null, '', `#${v}`);
    try { await (v === 'dash' ? dash() : v === 'site' ? site() : profileView ? tutorProfile() : cardView ? staffIdCard() : builderView ? courseBuilder() : inboxView ? staffInbox() : groupsView ? tutorGroups(null) : studentCardsView ? studentIdDirectory() : list(v)); } catch (er) { console.error(er); $('panel').innerHTML = empty('Something went wrong', 'Refresh the page and try again.'); }
  }
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (b) go(b.dataset.v); });
  addEventListener('hashchange', () => go(location.hash.slice(1)));
  go(location.hash.slice(1));
  const adminLiveChannel = supabase.channel(`admin-dashboard-live-${me.id}`);
  ['profiles','courses','enrollments','payments','assignment_submissions','notifications','contact_messages','certificates','tutor_group_posts','course_discussions'].forEach((table) => adminLiveChannel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
    if (activeAdminView === 'dash' && !adminOverviewRefresh) adminOverviewRefresh = setTimeout(() => { adminOverviewRefresh = null; go('dash'); }, 450);
  }));
  adminLiveChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') setLiveStatus('is-live', 'Live');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLiveStatus('is-offline', 'Reconnecting');
  });
}
