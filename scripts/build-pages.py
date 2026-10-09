"""Generates the static HTML pages in /public so the SEO head, skip link and shell are identical everywhere.
Run: python3 scripts/build-pages.py   (optional; you can also edit the generated .html files directly)"""
import os
PUB = os.path.join(os.path.dirname(__file__), '..', 'public')
SITE = 'https://courssin.com.ng'
FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap'

def head(title, desc, path, noindex=False, extra=''):
    full = title if 'Courssins' in title else f'{title} | Courssins Technology Institute'
    robots = '<meta name="robots" content="noindex,nofollow">' if noindex else ''
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{full}</title>
<meta name="description" content="{desc}">
{robots}
<link rel="canonical" href="{SITE}/{path}">
<meta name="theme-color" content="#0c0d0b">
<meta property="og:site_name" content="Courssins Technology Institute">
<meta property="og:type" content="website">
<meta property="og:title" content="{full}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}/{path}">
<meta property="og:image" content="{SITE}/assets/images/og-image.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="assets/images/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="{FONTS}"></noscript>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/responsive.css">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1D5EQE0SWB"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-1D5EQE0SWB');
</script>
<script>document.documentElement.classList.add('js')</script>
{extra}
</head>
'''

def page(name, title, desc, main, script='', noindex=False, shell=True, extra_head='', body_attr=''):
    h = head(title, desc, name, noindex, extra_head)
    top = '<div id="site-header" style="min-height:76px"></div>' if shell else ''
    bot = '<div id="site-footer"></div>' if shell else ''
    sc = f'<script type="module" src="assets/js/{script}"></script>' if script else ''
    html = f'''{h}<body {body_attr}>
<a class="skip" href="#main">Skip to content</a>
{top}
<main id="main">
{main}
</main>
{bot}
<script type="module" src="assets/js/app.js"></script>
{sc}
</body>
</html>
'''
    open(os.path.join(PUB, name), 'w').write(html)

ARR = '<svg class="icon icon-go" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
def ico(p, s=22): return f'<svg class="icon" width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p}</svg>'
TICK = ico('<path d="M20 6L9 17l-5-5"/>', 14)
AURORA = '<div class="aurora" aria-hidden="true"><span class="blob blob-lime" style="width:420px;height:420px;right:-80px;top:-120px"></span><span class="blob blob-violet" style="width:360px;height:360px;left:-100px;bottom:-140px;animation-delay:-8s"></span></div>'
NEWS = '''<section class="section-tight" aria-labelledby="memberTitle"><div class="container"><div class="member" data-reveal>
<span class="aurora" aria-hidden="true"><span class="blob blob-lime" style="width:380px;height:380px;left:-90px;top:-120px"></span><span class="blob blob-violet" style="width:320px;height:320px;right:-80px;bottom:-140px;animation-delay:-6s"></span></span>
<span class="eyebrow">Membership</span>
<h2 id="memberTitle">Join Membership And Connect To Every Member</h2>
<p class="lead" id="memberText">Get course announcements, study tips and new resources in your inbox. No spam, unsubscribe any time.</p>
<form class="member-form" data-newsletter novalidate><label class="sr" for="memberEmail" style="position:absolute;left:-9999px">Email address</label><input id="memberEmail" type="email" name="email" placeholder="Enter your email address" autocomplete="email" required><button class="btn btn-lime" type="submit">Join now</button></form>
<p class="form-msg" role="status"></p></div></div></section>
<div style="height:clamp(40px,6vw,80px)"></div>'''

# ------------------------------------------------------------------ HOME
FLOW = '<svg class="flow-lines" viewBox="0 0 1440 800" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 560 C 260 420, 420 720, 720 560 S 1200 360, 1460 520"/><path d="M-20 640 C 300 520, 460 780, 760 640 S 1180 480, 1460 600"/></svg>'
home = f'''<section class="hero" aria-labelledby="heroTitle">
{AURORA}<div class="aurora" aria-hidden="true"><div class="grid-bg"></div></div>{FLOW}
<div class="container hero-grid">
<div class="hero-copy">
<span class="eyebrow" id="heroLabel">Enrolment is open</span>
<h1 id="heroTitle">Practical tech skills, taught by working professionals.</h1>
<p class="lead" id="heroText">Courssins Technology Institute is an online learning platform in Nigeria for digital skills training: design, development, data, security and professional skills, with mentors, assignments and verified certificates.</p>
<div class="hero-actions"><a class="btn btn-lime btn-lg" id="heroPrimary" href="courses.html"><span>Explore courses</span>{ARR}</a><a class="btn btn-outline btn-lg" id="heroSecondary" href="tutors.html">Meet the tutors</a></div>
<div class="proof"><div class="avatars" aria-hidden="true"><span>AO</span><span>TB</span><span>HY</span><span>NA</span></div><p><strong id="heroProof">600+ learners reached</strong>Join learners building skills online</p></div>
</div>
<div class="hero-art">
<span class="ring ring-1" aria-hidden="true"></span><span class="ring ring-2" aria-hidden="true"></span>
<div class="hero-photo" data-parallax=".05"><img src="assets/images/hero.svg" width="900" height="1000" alt="Learner building a website on a laptop during a Courssins online course" fetchpriority="high" decoding="async"></div>
<div class="float-card glass fc-1"><span class="fc-icon">{ico('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>')}</span><div><strong>New cohorts open</strong>Study on your schedule</div></div>
<a class="float-card fc-ai fc-2" href="courses.html#finder" style="border-radius:22px;padding:14px 18px"><span class="fc-icon">{ico('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>')}</span><div><strong>Course finder</strong><span>Which skill fits your goal?</span><br><span class="typing" aria-hidden="true"><i></i><i></i><i></i></span></div></a>
<div class="float-card glass fc-3"><span class="fc-icon">{ico('<circle cx="12" cy="8" r="7"/><path d="M8.2 13.9L7 23l5-3 5 3-1.2-9.1"/>')}</span><div><strong>Verified certificates</strong>Checkable by employers</div></div>
</div></div></section>

<div class="stats-wrap"><div class="container"><div class="stats" id="statsGrid" role="list" aria-label="Courssins in numbers">
<div class="stat" role="listitem"><div class="stat-num"><span data-count="10" data-suffix="">0</span><span class="suffix">+</span></div><div class="stat-label">Professional programmes</div></div>
<div class="stat" role="listitem"><div class="stat-num"><span data-count="99">0</span><span class="suffix">%</span></div><div class="stat-label">Student satisfaction</div></div>
<div class="stat" role="listitem"><div class="stat-num"><span data-count="500">0</span><span class="suffix">+</span></div><div class="stat-label">Learning resources</div></div>
<div class="stat" role="listitem"><div class="stat-num"><span data-count="600">0</span><span class="suffix">+</span></div><div class="stat-label">Learners reached</div></div>
</div></div></div>

<section class="section" aria-labelledby="talentTitle"><div class="container talent-grid">
<div><span class="eyebrow outline">How we teach</span><h2 id="talentTitle" data-reveal>Talent Transformation</h2>
<p class="lead" id="talentText" data-reveal>We combine live guidance, a purpose-built learning platform and practical projects, so learning turns into skills that employers and clients can see.</p>
<div class="feature-grid" id="talentCards"></div></div>
<div class="talent-media"><div class="frame" data-reveal="img" data-parallax=".04"><img src="assets/images/talent.svg" width="800" height="900" alt="Students collaborating in a Courssins workshop session" loading="lazy" decoding="async"></div>
<div class="float-card glass" data-reveal><span class="fc-icon">{ico('<path d="M18 20V10M12 20V4M6 20v-6"/>')}</span><div><strong>Progress you can see</strong>Lessons, tasks and exams tracked</div></div></div>
</div></section>

<section class="why dark section" aria-labelledby="whyTitle">
<div class="aurora" aria-hidden="true"><div class="grid-bg"></div><span class="blob blob-lime" style="width:520px;height:520px;left:50%;top:-260px;margin-left:-260px"></span></div>
<div class="container"><div class="section-head center"><span class="eyebrow outline">Why Courssins</span><h2 id="whyTitle" data-reveal>Why Should You Choose Courssins</h2><p class="lead muted" id="whyText" data-reveal>Everything is designed around one outcome: helping you finish with skills you can prove.</p></div>
<div class="why-grid" id="whyGrid"></div></div></section>

<section class="section" aria-labelledby="coursesTitle"><div class="container">
<div class="section-head"><div><span class="eyebrow outline">Programmes</span><h2 id="coursesTitle" style="margin-top:16px" data-reveal>Courses that lead to real work</h2></div><a class="btn btn-outline" href="courses.html">View all courses</a></div>
<div class="grid grid-3" id="homeCourses"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div></div></section>

<section class="section band-soft" style="border-radius:var(--r-xl)" aria-labelledby="tutorsTitle"><div class="container" data-carousel>
<div class="section-head"><div><span class="eyebrow outline">Mentors</span><h2 id="tutorsTitle" style="margin-top:16px" data-reveal>Learn from experienced tutors</h2></div>
<div class="carousel-nav"><button class="icon-btn" data-prev aria-label="Previous tutors">{ico('<path d="M19 12H5M12 19l-7-7 7-7"/>')}</button><button class="icon-btn" data-next aria-label="Next tutors">{ico('<path d="M5 12h14M12 5l7 7-7 7"/>')}</button></div></div>
<div class="track" data-track id="homeTutors" tabindex="0" aria-label="Tutors, scroll horizontally"></div></div></section>

<section class="section" aria-labelledby="blogTitle"><div class="container">
<div class="section-head"><div><span class="eyebrow outline">Insights</span><h2 id="blogTitle" style="margin-top:16px" data-reveal>Trending Blog and Articles</h2></div><a class="btn btn-outline" href="blog.html">All articles</a></div>
<div class="grid grid-3" id="homePosts"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div></div></section>
{NEWS}'''
ld = f'''<script type="application/ld+json">{{"@context":"https://schema.org","@type":"EducationalOrganization","name":"Courssins Technology Institute","description":"Online technology institute in Nigeria offering practical digital skills training.","url":"{SITE}","areaServed":"NG","sameAs":[]}}</script>'''
page('index.html', 'Courssins Technology Institute | Online Tech Courses in Nigeria', 'Courssins Technology Institute is an online technology institute in Nigeria. Digital skills training in web development, graphic design, UI/UX, data analysis and cybersecurity, with verified certificates.', home, 'home.js', extra_head=ld)

# ------------------------------------------------------------------ ABOUT
about = f'''<section class="page-hero">{AURORA}<div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>About</span></nav>
<span class="eyebrow" style="margin-top:20px">About us</span><h1>A technology institute built around practical skills</h1>
<p class="lead">Courssins Technology Institute is an online learning platform in Nigeria. We teach technology and professional skills through projects, mentor feedback and honest assessment.</p></div></section>
<section class="section"><div class="container grid grid-2" style="align-items:center;gap:clamp(32px,6vw,80px)">
<div><h2 data-reveal>Skills you can show, not just certificates you can frame</h2>
<p class="lead" style="margin-top:18px" data-reveal>Every programme is designed around work you will actually do: building websites, designing interfaces, analysing data, protecting accounts, managing projects. You finish with finished projects and a certificate that employers can verify online.</p></div>
<ul class="ticks" data-reveal>
<li><span class="tick">{TICK}</span><span><strong>Taught by practitioners.</strong> Tutors work in the fields they teach.</span></li>
<li><span class="tick">{TICK}</span><span><strong>Structured, not scattered.</strong> Modules, lessons, assignments and exams in one platform.</span></li>
<li><span class="tick">{TICK}</span><span><strong>Study anywhere.</strong> Learn on a phone or laptop at your own pace.</span></li>
<li><span class="tick">{TICK}</span><span><strong>Honest assessment.</strong> Certificates are issued only after all work is completed.</span></li></ul></div></section>
<section class="section band-soft" style="border-radius:var(--r-xl)"><div class="container"><div class="section-head"><h2>How learning works</h2></div>
<div class="steps"><div class="step" data-reveal><h3>Choose a programme</h3><p>Compare programmes, tutors and fees, then enrol from the course page.</p></div>
<div class="step" data-reveal><h3>Learn and practise</h3><p>Work through lessons, submit assignments and get feedback from your tutor.</p></div>
<div class="step" data-reveal><h3>Get certified</h3><p>Pass your examinations and download a certificate with a unique verification number.</p></div></div>
<div class="btn-row" style="margin-top:40px"><a class="btn btn-lime btn-lg" href="courses.html">Browse courses</a><a class="btn btn-outline btn-lg" href="contact.html">Talk to us</a></div></div></section>
<div style="height:clamp(40px,6vw,80px)"></div>'''
page('about.html', 'About Courssins Technology Institute', 'Learn about Courssins Technology Institute, an online technology institute in Nigeria delivering practical digital skills training with mentors and verified certificates.', about)

# ------------------------------------------------------------------ COURSES
courses = f'''<section class="page-hero">{AURORA}<div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>Courses</span></nav>
<h1>Technology courses in Nigeria</h1><p class="lead">Online tech courses and professional skills programmes: web development, graphic design, UI/UX, data analysis, cybersecurity and more.</p></div></section>
<section class="section-tight"><div class="container" style="padding-top:40px">
<div class="finder" id="finder"><h2>{ico('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>')}Course finder</h2><p style="color:#a9aea0;margin-top:6px">Tell us what you want to do and we will suggest programmes.</p>
<form id="finderForm"><label for="finderInput" style="position:absolute;left:-9999px">Your goal</label><input class="input" id="finderInput" placeholder="e.g. I want to build websites, or work remotely" autocomplete="off"><button class="btn btn-lime" type="submit">Suggest courses</button></form><div class="finder-out" id="finderOut" aria-live="polite"></div></div>
<div class="filters" id="courseFilters" role="group" aria-label="Filter by category"></div>
<div class="grid grid-3" id="courseGrid"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div></div></section>
<div style="height:clamp(40px,6vw,80px)"></div>'''
page('courses.html', 'Online Tech Courses in Nigeria', 'Browse Courssins courses: web development, graphic design, UI/UX design, data analysis, cybersecurity, virtual assistance, project management and more. Online technology courses in Nigeria.', courses, 'courses.js')
page('course.html', 'Course', 'Course details at Courssins Technology Institute: modules, outcomes, requirements, tutor, price and certificate.', '<div class="container" style="padding-block:40px 80px" id="courseRoot"><div class="card skeleton" style="min-height:520px"></div></div>', 'course.js')

# ------------------------------------------------------------------ TUTORS
page('tutors.html', 'Our Tutors', 'Meet the Courssins tutors: experienced practitioners teaching design, development, data, security and professional skills online.',
     f'''<section class="page-hero">{AURORA}<div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>Tutors</span></nav><h1>Learn from people who do the work</h1><p class="lead">Our tutors are practitioners who teach with real projects, direct feedback and clear standards.</p></div></section>
<section class="section"><div class="container"><div class="grid grid-4" id="tutorGrid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div></div></section>''', 'tutors.js')
page('tutor.html', 'Tutor profile', 'Tutor profile at Courssins Technology Institute.', '<div class="container" style="padding-block:40px 80px" id="tutorRoot"><div class="card skeleton" style="min-height:520px"></div></div>', 'tutors.js')

# ------------------------------------------------------------------ LIBRARY / BLOG
page('library.html', 'Digital Library', 'Free and member learning resources: books, documents, videos and study materials curated by Courssins Technology Institute.',
     f'''<section class="page-hero">{AURORA}<div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>Library</span></nav><h1>Digital learning library</h1><p class="lead">Books, documents, videos and study materials to support your learning. Member resources appear when you are logged in.</p></div></section>
<section class="section-tight"><div class="container" style="padding-top:40px"><div class="filters" id="libFilters" role="group" aria-label="Filter by type"></div><div class="grid grid-3" id="libGrid"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div></div></section><div style="height:80px"></div>''', 'library.js')
page('blog.html', 'Blog and Articles', 'Career advice, technology guides and learning tips from Courssins Technology Institute.',
     f'''<section class="page-hero">{AURORA}<div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>Blog</span></nav><h1>Trending blog and articles</h1><p class="lead">Practical guides on digital skills, careers and learning online.</p></div></section>
<section class="section-tight"><div class="container" style="padding-top:40px"><div class="filters" id="blogFilters" role="group" aria-label="Filter by category"></div><div class="grid grid-3" id="blogGrid"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div></div></section><div style="height:80px"></div>''', 'blog.js')
page('article.html', 'Article', 'Article from the Courssins Technology Institute blog.', '<div class="container" style="padding-block:40px 80px" id="articleRoot"><div class="card skeleton" style="min-height:520px"></div></div>', 'blog.js')

# ------------------------------------------------------------------ CUSTOM PAGES
page('page.html', 'Page', 'Courssins Technology Institute.', '<div id="pageRoot" style="min-height:50vh"></div>', 'page.js')
page('pages.html', 'All Pages', 'Browse information pages from Courssins Technology Institute.',
     f'''<section class="page-hero">{AURORA}<div class="container"><h1>Information pages</h1><p class="lead">Admissions, handbooks, policies and more.</p></div></section><section class="section"><div class="container"><div class="grid grid-3" id="pagesList"></div></div></section>''', 'page.js', body_attr='data-mode="list"')

# ------------------------------------------------------------------ CONTACT
page('contact.html', 'Contact Us', 'Contact Courssins Technology Institute with questions about courses, admissions, payments or partnerships.',
     f'''<section class="page-hero">{AURORA}<div class="container"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a><span>/</span><span>Contact</span></nav><h1>Talk to Courssins</h1><p class="lead">Questions about a programme, admissions or payments? Send a message and we will reply by email.</p></div></section>
<section class="section"><div class="container contact-grid"><div><h2>How can we help?</h2><p class="lead" style="margin-top:14px">Tell us which course you are considering and what you want to achieve.</p><ul class="info-list" id="contactInfo"></ul></div>
<form class="panel" id="contactForm" novalidate><div class="row-2"><div class="field"><label for="cName">Full name</label><input class="input" id="cName" name="name" autocomplete="name" required maxlength="120"><div class="field-error" data-err="name"></div></div>
<div class="field"><label for="cEmail">Email</label><input class="input" id="cEmail" type="email" name="email" autocomplete="email" required maxlength="254"><div class="field-error" data-err="email"></div></div></div>
<div class="field"><label for="cSubject">Subject</label><input class="input" id="cSubject" name="subject" maxlength="200"></div>
<div class="field"><label for="cMessage">Message</label><textarea class="input" id="cMessage" name="message" required maxlength="4000"></textarea><div class="field-error" data-err="message"></div></div>
<div class="alert" id="cAlert" hidden></div><button class="btn btn-lime btn-lg" type="submit">Send message</button></form></div></section>''', 'contact.js')

# ------------------------------------------------------------------ CERTIFICATE VERIFY
page('certificate-verify.html', 'Verify a Certificate', 'Verify a Courssins Technology Institute certificate using its unique certificate number.',
     f'''<section class="page-hero">{AURORA}<div class="container"><h1>Verify a certificate</h1><p class="lead">Enter the certificate number printed on a Courssins certificate to confirm it is genuine.</p></div></section>
<section class="section"><div class="container" style="max-width:720px"><form id="verifyForm" class="member-form" style="margin:0" novalidate><label for="certNo" style="position:absolute;left:-9999px">Certificate number</label><input id="certNo" name="n" placeholder="e.g. CTI-2026-AB12CD34" autocomplete="off" required><button class="btn btn-lime" type="submit">Verify</button></form><div id="verifyOut" aria-live="polite"></div></div></section><div style="height:80px"></div>''', 'certificate.js')

# ------------------------------------------------------------------ AUTH
def auth_side(h, items):
    li = ''.join(f'<li>{TICK.replace("14","18")}<span>{i}</span></li>' for i in items)
    return f'''<aside class="auth-side"><div class="aurora" aria-hidden="true"><div class="grid-bg"></div><span class="blob blob-lime" style="width:420px;height:420px;right:-100px;top:-100px"></span></div><span class="eyebrow" style="align-self:flex-start;margin-bottom:22px">Courssins</span><h1>{h}</h1><ul>{li}</ul></aside>'''
EYE = ico('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', 20)
login = f'''<div class="auth">{auth_side('Welcome back to your learning.', ['Pick up where you left off','Track lessons, assignments and exams','Download and share your certificates'])}
<div class="auth-main"><div class="auth-card">
<div id="loginPanel"><h2>Log in</h2><p class="muted">Use the email and password you registered with.</p>
<div class="alert" id="authAlert" hidden role="alert"></div>
<form id="loginForm" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" type="email" name="email" autocomplete="email" required><div class="field-error" data-err="email"></div></div>
<div class="field"><label for="password">Password</label><div class="pw"><input class="input" id="password" type="password" name="password" autocomplete="current-password" required><button type="button" data-toggle-pw aria-label="Show password">{EYE}</button></div><div class="field-error" data-err="password"></div></div>
<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:22px;flex-wrap:wrap"><label class="check"><input type="checkbox" id="remember" checked> Remember me</label><button type="button" class="link-arrow" id="forgotBtn" style="background:none;border:0;padding:0;text-decoration:underline">Forgot password?</button></div>
<button class="btn btn-lime btn-lg btn-block" type="submit">Log in</button></form>
<p class="auth-alt">New to Courssins? <a href="signup.html">Create an account</a></p></div>
<div id="forgotPanel" hidden><h2>Reset password</h2><p class="muted">We will email you a link to choose a new password.</p><div class="alert" id="forgotAlert" hidden role="alert"></div>
<form id="forgotForm" novalidate><div class="field"><label for="fEmail">Email</label><input class="input" id="fEmail" type="email" autocomplete="email" required><div class="field-error" data-err="fEmail"></div></div><button class="btn btn-lime btn-lg btn-block" type="submit">Send reset link</button></form><p class="auth-alt"><button type="button" id="backLogin" style="background:none;border:0;font-weight:700;text-decoration:underline">Back to log in</button></p></div>
<div id="resetPanel" hidden><h2>Choose a new password</h2><p class="muted">Use at least 8 characters.</p><div class="alert" id="resetAlert" hidden role="alert"></div>
<form id="resetForm" novalidate><div class="field"><label for="newPw">New password</label><div class="pw"><input class="input" id="newPw" type="password" autocomplete="new-password" required minlength="8"><button type="button" data-toggle-pw aria-label="Show password">{EYE}</button></div><div class="field-error" data-err="newPw"></div></div><button class="btn btn-lime btn-lg btn-block" type="submit">Update password</button></form></div>
</div></div></div>'''
page('login.html', 'Log in', 'Log in to your Courssins Technology Institute account.', login, 'auth.js', noindex=True, body_attr='data-auth-page="login"')
signup = f'''<div class="auth">{auth_side('Start learning skills that get used.', ['Choose from professional programmes','Learn on your phone or laptop','Earn a certificate that can be verified'])}
<div class="auth-main"><div class="auth-card" style="width:min(560px,100%)"><h2>Create your account</h2><p class="muted">It takes a minute. Course access unlocks after enrolment and verified payment.</p>
<div class="alert" id="authAlert" hidden role="alert"></div>
<form id="signupForm" novalidate>
<div class="field"><label for="full_name">Full name</label><input class="input" id="full_name" name="full_name" autocomplete="name" required maxlength="120"><div class="field-error" data-err="full_name"></div></div>
<div class="row-2"><div class="field"><label for="email">Email</label><input class="input" id="email" type="email" name="email" autocomplete="email" required><div class="field-error" data-err="email"></div></div>
<div class="field"><label for="phone">Phone number</label><input class="input" id="phone" type="tel" name="phone" autocomplete="tel" placeholder="+234 800 000 0000" required><div class="field-error" data-err="phone"></div></div></div>
<div class="row-2"><div class="field"><label for="country">Country</label><select class="input" id="country" name="country" required></select><div class="field-error" data-err="country"></div></div>
<div class="field"><label for="interest">Programme of interest</label><select class="input" id="interest" name="interest" required></select><div class="field-error" data-err="interest"></div></div></div>
<div class="row-2"><div class="field"><label for="password">Password</label><div class="pw"><input class="input" id="password" type="password" name="password" autocomplete="new-password" required minlength="8"><button type="button" data-toggle-pw aria-label="Show password">{EYE}</button></div><div class="strength" aria-hidden="true"><i id="strengthBar"></i></div><div class="field-error" data-err="password"></div></div>
<div class="field"><label for="confirm">Confirm password</label><div class="pw"><input class="input" id="confirm" type="password" name="confirm" autocomplete="new-password" required><button type="button" data-toggle-pw aria-label="Show password">{EYE}</button></div><div class="field-error" data-err="confirm"></div></div></div>
<label class="check" style="margin-bottom:22px"><input type="checkbox" id="agree" required> <span>I agree to the <a href="page.html?slug=terms-and-conditions" style="text-decoration:underline">Terms</a> and <a href="page.html?slug=privacy-policy" style="text-decoration:underline">Privacy Policy</a></span></label><div class="field-error" data-err="agree" style="margin-top:-14px;margin-bottom:12px"></div>
<button class="btn btn-lime btn-lg btn-block" type="submit">Create account</button></form>
<p class="auth-alt">Already registered? <a href="login.html">Log in</a></p></div></div></div>'''
page('signup.html', 'Sign up', 'Create your Courssins Technology Institute account to enrol in online tech courses.', signup, 'auth.js', noindex=True, body_attr='data-auth-page="signup"')

# ------------------------------------------------------------------ APP SHELLS
def shell(kind, brand_sub):
    return f'''<div class="side-scrim" id="scrim"></div>
<div class="app"><aside class="sidebar" id="sidebar" aria-label="{kind} navigation">
<a class="logo" href="index.html"><img src="assets/images/logo-mark.svg" width="38" height="38" alt=""><span class="logo-text">Courssins</span></a>
<div id="sideNav"></div>
<div class="side-foot"><a class="side-link" href="index.html">{ico('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',18)}Back to website</a><button class="side-link" id="signOutBtn" type="button">{ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',18)}Log out</button></div></aside>
<div class="app-main"><div class="app-top"><div style="display:flex;gap:14px;align-items:center"><button class="icon-btn app-menu-btn" id="menuBtn" aria-label="Open menu" type="button">{ico('<path d="M3 6h18M3 12h18M3 18h18"/>')}</button><h1 id="panelTitle">{brand_sub}</h1></div><div id="whoami" class="muted"></div></div>
<div id="panel" aria-live="polite"><div class="card skeleton" style="min-height:300px"></div></div></div></div>'''
page('dashboard.html', 'Student Dashboard', 'Your Courssins learning dashboard.', shell('Student', 'Dashboard'), 'dashboard.js', noindex=True, shell=False)
page('admin.html', 'Admin Dashboard', 'Courssins administration.', shell('Admin', 'Admin'), 'admin.js', noindex=True, shell=False)

# ------------------------------------------------------------------ 404
page('404.html', 'Page not found', 'This page could not be found.', f'''<section class="section"><div class="container" style="text-align:center;max-width:640px"><span class="eyebrow">404</span><h1 style="margin:20px 0">That page does not exist</h1><p class="lead" style="margin-inline:auto">The link may be old or mistyped. Try the courses page or head back home.</p><div class="btn-row" style="justify-content:center;margin-top:28px"><a class="btn btn-lime btn-lg" href="index.html">Go home</a><a class="btn btn-outline btn-lg" href="courses.html">Browse courses</a></div></div></section>''', noindex=True, extra_head='<base href="/">')
print('pages written')
