# Courssins Technology Institute website

Static HTML + CSS + vanilla JavaScript, talking directly to Supabase (Auth, Postgres with Row Level Security, Storage). Deploys to Vercel with no build step and no Node backend.

```
courssins/
  vercel.json                  Vercel config (serves /public, security + cache headers)
  public/                      the website (this is what Vercel serves)
    index.html about.html courses.html course.html tutors.html tutor.html library.html
    blog.html article.html login.html signup.html dashboard.html admin.html learn.html
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
    migrations/                 additive upgrades for tutor assignments, private resources, lesson pages, quizzes, discussions, ads and staff ID cards
    functions/admin-users, resend-notifications       account management and email alerts
    functions/paystack-initialize, paystack-webhook   payment gateway (Edge Functions)
  scripts/  generate-seed.mjs  build-pages.py  make-images.py   (optional regeneration helpers)
```

## 1. Set up Supabase (about 10 minutes)
1. Create a project at supabase.com.
2. **SQL Editor**: on a fresh, dedicated project, paste and run `supabase/schema.sql`, then run every file in `supabase/migrations/` in filename order, and finally run `supabase/seed.sql`. Do not run the baseline schema on a shared or established database: it recreates policies across the `public` schema.
  For an existing Courssins installation, back up the database, run the files in `supabase/migrations/` in filename order, then run `supabase/seed.sql` to refresh the legal pages and supported defaults.
3. Copy `.env.example` to `.env` and fill in your real values. The repo uses `scripts/link-env.mjs` to generate `public/assets/js/config.js` automatically from those environment variables before Vercel deploys the site. These two values are meant to be public. **Never** paste the `service_role` key anywhere in `public/`.
4. **Authentication > URL Configuration**: set Site URL to `https://courssin.com.ng` and add `https://courssin.com.ng/login.html` to Redirect URLs (needed for email confirmation and password reset). Configure an SMTP provider for production email volume. Set the sender/support address to `support.courssintech@gmail.com` where appropriate.
5. Sign up on the website, then make yourself Super Admin by running this in the SQL Editor:
   `update public.profiles set role = 'super_admin' where email = 'you@example.com';`
   Log in again and you are sent to `/admin`.
6. **Auth email delivery**: configure Supabase Auth SMTP and allow `https://courssin.com.ng/login.html` as a redirect URL. Tutor and admin invitations use this link for first-password setup; password resets use the same configured email provider.
7. Deploy the account-management function after applying the migrations and set its public redirect origin:
  ```
  supabase secrets set SITE_URL=https://courssin.com.ng
  supabase functions deploy admin-users
  ```
  It checks the caller's Super Admin role itself; `SUPABASE_SERVICE_ROLE_KEY` stays in the Supabase Edge Function environment and must never be added to browser config.
8. **Contact and membership email alerts**: verify a sending domain in Resend, then configure the new Resend API key, the exact inbox/alias you want to receive alerts, and a sender address on that verified domain as Supabase Edge Function secrets. For example:
  ```
  supabase secrets set RESEND_API_KEY=<rotated-key> CONTACT_NOTIFY_EMAIL=<anything>@aideuvorou.resend.app RESEND_FROM_EMAIL="Courssins Website <notifications@your-verified-domain>"
  supabase functions deploy resend-notifications --no-verify-jwt
  ```
  Replace each placeholder with a valid value. `<real-inbox>` must be an address or alias that is actually configured to receive mail; a wildcard address is not a destination. The Resend API key and destination are used only by the Edge Function, never by browser code. Contact submissions and new membership signups are saved first; notifications are rate-limited and duplicate sends are suppressed.
9. **Certificate signature**: after the migration is applied, open Admin > Website content > Certificate signature and upload the provided signature image. Set the signatory name and title there; newly issued certificates render the image when printed.

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
| student | read own profile, enrolments, payments, results, certificates; complete course sections, submit assignment text/files, join lesson discussions, and take timed quizzes |
| tutor | use Course Builder for assigned courses; manage modules, lessons, private resources, assignments and quizzes; grade submissions; view enrolled students and discussions **for courses assigned to them**; edit their own tutor profile and view their staff ID |
| admin | everything above plus students, courses, tutors, payments, certificates, events, advertisements, library, blog, newsletter, messages and discussions |
| super_admin | also invite/manage staff accounts, custom pages, website settings, roles and certificate signature |

Key protections: public signups always create `student` accounts; tutor/admin accounts are invited by the Super Admin through the server-side Edge Function; role and active-status changes are Super Admin-only. Disabled accounts lose authentication access and tutor course ownership. Private course videos, resources and assignment submissions use the private storage bucket with enrollment/ownership policies and signed downloads. Students continue to access active course materials after a certificate is issued. Module quizzes require 7 questions; the final quiz requires 15, and server-side 13-minute timers prevent client-only score submission. `begin_exam` returns questions without answer keys and `submit_exam_attempt` scores an unexpired attempt. Certificates require completed sections, tutor-graded assignments, passed module quizzes, and a passed final quiz. Admins can revoke certificates and staff ID cards.

Custom pages: admin-written HTML is sanitised (scripts, iframes, forms and event handlers removed) and shown inside a Shadow DOM so page CSS cannot restyle the site. No server-side code is executed.

## Things to do before launch
- **Replace sample content.** Tutor names, bios, qualifications, prices, durations, the 10+/99%/500+/600+ statistics, contact email and social links are placeholders. Edit them in Admin (Tutors, Courses, Website content). Only publish statistics that are true.
- **Replace the placeholder artwork** in `assets/images` (or upload photos in Admin and paste the URL). Files are SVG illustrations because no photographs were available; real photography will lift the design considerably.
- Terms and Privacy pages are editable policy drafts; have them reviewed by a qualified adviser before relying on them.
- Upload the institute signature in Admin > Website content > Certificate signature. Certificates use that uploaded image when printed.
- Dynamic pages (course, tutor, article, custom page) set their title, description and structured data with JavaScript. Google renders this, but some social-preview crawlers do not read it; those show the generic page tags.
- Lessons are created with placeholder notes from the seed; add real notes and a video URL or upload a video in Admin > Lessons. Uploaded lesson videos are private and stream through signed links for enrolled students.
- Add at least one published final quiz (15 questions), any module quizzes (7 questions each), lessons, and assignments; students cannot receive a certificate until those requirements are completed and passed/graded.

## Running locally
Copy `.env.example` to `.env`, fill in your values, then run `node scripts/link-env.mjs` before serving the site. Any static server works: `cd public && python3 -m http.server 8000`. Without keys in the env file or Vercel environment variables the site runs on sample content and shows clear "connect Supabase" messages where accounts are needed.
