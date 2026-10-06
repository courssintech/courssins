# Courssins Technology Institute website

Static HTML + CSS + vanilla JavaScript, talking directly to Supabase (Auth, Postgres with Row Level Security, Storage). Deploys to Vercel with no build step and no Node backend.

```
courssins/
  vercel.json                  Vercel config (serves /public, security + cache headers)
  public/                      the website (this is what Vercel serves)
    index.html about.html courses.html course.html tutors.html tutor.html library.html
    blog.html article.html login.html signup.html dashboard.html admin.html
    pages.html page.html contact.html certificate-verify.html 404.html robots.txt sitemap.xml
    components/header.html footer.html
    assets/css/style.css responsive.css
    assets/js/  config.js (your keys) supabase.js app.js api.js data.js ui.js fx.js icons.js
                home.js courses.js course.js tutors.js library.js blog.js page.js contact.js
                certificate.js auth.js dashboard.js admin.js
    assets/images/  illustrated placeholder artwork (replace with photographs)
  supabase/
    schema.sql                 tables, RLS policies, RPC functions, storage bucket
    seed.sql                   sample courses, tutors, articles, library, settings, terms/privacy
    functions/paystack-initialize, paystack-webhook   payment gateway (Edge Functions)
  scripts/  generate-seed.mjs  build-pages.py  make-images.py   (optional regeneration helpers)
```

## 1. Set up Supabase (about 10 minutes)
1. Create a project at supabase.com.
2. **SQL Editor**: paste and run `supabase/schema.sql`, then run `supabase/seed.sql`.
  For an existing project, rerun the updated `supabase/seed.sql` to refresh the saved support email without replacing other site settings.
3. Copy `.env.example` to `.env` and fill in your real values. The repo uses `scripts/link-env.mjs` to generate `public/assets/js/config.js` automatically from those environment variables before Vercel deploys the site. These two values are meant to be public. **Never** paste the `service_role` key anywhere in `public/`.
4. **Authentication > URL Configuration**: set Site URL to `https://courssin.com.ng` and add `https://courssin.com.ng/login.html` to Redirect URLs (needed for email confirmation and password reset). Configure an SMTP provider for production email volume. Set the sender/support address to `support.courssintech@gmail.com` where appropriate.
5. Sign up on the website, then make yourself Super Admin by running this in the SQL Editor:
   `update public.profiles set role = 'super_admin' where email = 'you@example.com';`
   Log in again and you are sent to `/admin`.

## 2. Deploy to Vercel
Import the folder (or push to GitHub and import). Framework preset: **Other**. `vercel.json` runs `node scripts/link-env.mjs` before deployment and serves the generated `public` folder. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL=https://courssin.com.ng`, and `PAYMENT_INIT_URL=https://ohkrwdmiqlkjcsnzbmma.supabase.co/functions/v1/paystack-initialize` in Vercel Environment Variables (and in `.env` for local development). Configure the custom domain in Vercel and update Supabase Authentication > URL Configuration with the Site URL and redirect URL above.

## 3. Payments (Paystack; Flutterwave can follow the same pattern)
Enrolling calls the `start_enrollment` database function, which creates a **pending** enrolment and a **pending** payment. Nothing unlocks until a payment row becomes `success`, which only happens through:
- the verified `paystack-webhook` function (checks Paystack's signature, re-verifies with Paystack's API, matches amount and currency), or
- an admin marking it successful after confirming money received (Admin > Payments).

Students cannot insert or change payments or enrolments (Row Level Security). To switch card payments on:
```
supabase functions deploy paystack-initialize
supabase functions deploy paystack-webhook --no-verify-jwt
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
```
Set the Paystack webhook URL to `https://<project>.supabase.co/functions/v1/paystack-webhook`, then put `https://<project>.supabase.co/functions/v1/paystack-initialize` in `PAYMENT_INIT_URL` in `config.js`. Until then the course page shows the student a payment reference and says online payment is not yet enabled; no fake confirmation is ever shown.

## Roles and security model
| Role | Can do (enforced by database policies, not by the browser) |
|---|---|
| student | read own profile, enrolments, payments, results, certificates; submit assignments/exams; mark lessons done |
| tutor | manage modules, lessons, assignments, exams and grade submissions **for courses assigned to them** (link the tutor's login in Admin > Tutors) |
| admin | everything above plus students, courses, tutors, payments, certificates, events, library, blog, newsletter, messages |
| super_admin | also custom pages, website content/settings, and user roles |

Key protections: new accounts are always `student`; only a super admin (or the SQL editor) can change a role; exam answer keys are readable by staff only (students get questions through `get_exam_questions`, and scoring happens in `submit_exam`); certificates are issued by `claim_certificate` only when every lesson, assignment and exam is complete; public certificate verification returns only name, course and dates for an exact certificate number.

Custom pages: admin-written HTML is sanitised (scripts, iframes, forms and event handlers removed) and shown inside a Shadow DOM so page CSS cannot restyle the site. No server-side code is executed.

## Things to do before launch
- **Replace sample content.** Tutor names, bios, qualifications, prices, durations, the 10+/99%/500+/600+ statistics, contact email and social links are placeholders. Edit them in Admin (Tutors, Courses, Website content). Only publish statistics that are true.
- **Replace the placeholder artwork** in `assets/images` (or upload photos in Admin and paste the URL). Files are SVG illustrations because no photographs were available; real photography will lift the design considerably.
- Terms and Privacy are starter texts; have them reviewed by a qualified adviser.
- Dynamic pages (course, tutor, article, custom page) set their title, description and structured data with JavaScript. Google renders this, but some social-preview crawlers do not read it; those show the generic page tags.
- Lessons are created with placeholder notes from the seed; add real notes and videos in Admin > Lessons.
- Add exams and assignments in Admin before students can complete a course (a course with none of them is never "complete" for certificate purposes unless it has lessons).

## Running locally
Copy `.env.example` to `.env`, fill in your values, then run `node scripts/link-env.mjs` before serving the site. Any static server works: `cd public && python3 -m http.server 8000`. Without keys in the env file or Vercel environment variables the site runs on sample content and shows clear "connect Supabase" messages where accounts are needed.
