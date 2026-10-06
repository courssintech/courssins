/* Sample content used (a) as the seed for Supabase and (b) as a fallback when Supabase is not configured yet.
   Once Supabase is connected, the live database is the source of truth. Replace all sample names, bios and prices with your real details. */

const tutorImg = (s) => `assets/images/tutors/${s}.svg`;
const courseImg = (s) => `assets/images/courses/${s}.svg`;
const SOC = { linkedin: 'https://www.linkedin.com/', x: 'https://x.com/', instagram: 'https://www.instagram.com/' };

export const tutors = [
  { slug: 'adaeze-okafor', full_name: 'Adaeze Okafor', title: 'Lead Instructor, Design', specialization: 'Graphic Design and UI/UX',
    bio: 'Adaeze teaches visual design as a working discipline: briefs, constraints, feedback and delivery. Her classes are built around real client-style projects so learners leave with finished portfolio pieces.',
    experience: 'Nine years in brand, packaging and product design for small businesses and start-ups.',
    qualifications: ['B.A. Fine and Applied Arts', 'Certified UX practitioner', 'Mentor on design apprenticeship programmes'],
    expertise: ['Brand identity', 'Typography', 'Interface design', 'Design systems', 'Portfolio review'] },
  { slug: 'tunde-bakare', full_name: 'Tunde Bakare', title: 'Senior Instructor, Web Engineering', specialization: 'Frontend and Full Stack Development',
    bio: 'Tunde helps beginners become dependable web developers. He focuses on fundamentals first, then on shipping projects with modern tooling and responsible use of AI assistants.',
    experience: 'Eight years building web applications for fintech, education and logistics teams.',
    qualifications: ['B.Sc. Computer Science', 'Open-source contributor', 'Conference speaker on web performance'],
    expertise: ['HTML and CSS', 'JavaScript', 'Web performance', 'Accessibility', 'AI-assisted development'] },
  { slug: 'chinedu-eze', full_name: 'Chinedu Eze', title: 'Instructor, Backend Engineering', specialization: 'Backend Development and AI',
    bio: 'Chinedu teaches how to design data models, build secure APIs and connect them to intelligent features. Expect code reviews, pair sessions and plenty of debugging practice.',
    experience: 'Seven years designing APIs and databases for SaaS and payments products.',
    qualifications: ['B.Eng. Electrical and Electronics', 'PostgreSQL specialist', 'API security workshop facilitator'],
    expertise: ['REST APIs', 'PostgreSQL', 'Authentication', 'Cloud deployment', 'LLM integrations'] },
  { slug: 'halima-yusuf', full_name: 'Halima Yusuf', title: 'Instructor, Data', specialization: 'Data Analysis',
    bio: 'Halima turns spreadsheets and messy datasets into clear stories. Her learners practise cleaning, analysing and presenting data the way business teams actually ask for it.',
    experience: 'Six years as an analyst in retail, health and public-sector programmes.',
    qualifications: ['B.Sc. Statistics', 'Certified data analytics associate'],
    expertise: ['Spreadsheets', 'SQL', 'Data cleaning', 'Dashboards', 'Data storytelling'] },
  { slug: 'ibrahim-lawal', full_name: 'Ibrahim Lawal', title: 'Instructor, Security', specialization: 'Cybersecurity',
    bio: 'Ibrahim makes security practical for beginners: understand how attacks work, protect accounts and devices, and build safer habits for individuals and small organisations.',
    experience: 'Seven years in IT support, network administration and security awareness training.',
    qualifications: ['B.Tech. Computer Engineering', 'Security fundamentals certified'],
    expertise: ['Network basics', 'Threat awareness', 'Account security', 'Incident response basics', 'Security policy'] },
  { slug: 'ngozi-adeyemi', full_name: 'Ngozi Adeyemi', title: 'Instructor, Operations', specialization: 'Project Management and Virtual Assistance',
    bio: 'Ngozi teaches the practical side of getting work done: planning, communication, tools and client service, for remote assistants and project coordinators alike.',
    experience: 'Ten years coordinating projects and remote teams across several industries.',
    qualifications: ['B.Sc. Business Administration', 'Project management practitioner certificate'],
    expertise: ['Project planning', 'Remote collaboration', 'Client communication', 'Productivity tools', 'Reporting'] },
  { slug: 'funmilayo-adebayo', full_name: 'Funmilayo Adebayo', title: 'Instructor, Wellbeing and Care', specialization: 'Mental Health and Child Safety',
    bio: 'Funmilayo leads courses on wellbeing and safeguarding for parents, teachers and community workers, with clear guidance on when and how to involve professionals.',
    experience: 'Eleven years in community education, counselling support and child welfare programmes.',
    qualifications: ['B.Ed. Guidance and Counselling', 'Safeguarding training facilitator'],
    expertise: ['Wellbeing awareness', 'Safeguarding', 'Parent education', 'Community outreach'] },
].map((t) => ({ ...t, image_url: tutorImg(t.slug), socials: SOC, email: '', published: true }));

const ASSESS = 'Assessment combines weekly assignments and a final examination. To be eligible for a certificate you complete every lesson, submit every assignment and pass each examination (pass mark 50%).';
const CERT = 'On completion you receive a Courssins Technology Institute certificate with a unique number that anyone can check on our public verification page.';
const FAQ = [
  { q: 'Do I need prior experience?', a: 'No. Every programme starts from the basics unless the requirements say otherwise.' },
  { q: 'How do I pay and get access?', a: 'Enrol on this page, then complete payment. Lessons unlock only after your payment has been verified.' },
  { q: 'Can I study on my phone?', a: 'Yes. The learning platform works on phones, tablets and laptops.' },
  { q: 'How do I get my certificate?', a: 'Finish all lessons, assignments and examinations. Your certificate then appears in your dashboard.' },
];
const M = (arr) => arr.map(([title, topics], i) => {
  const t = topics.split(';').map((s) => s.trim());
  return { position: i + 1, title, topics: t, summary: 'Covers ' + t.map((s) => s.toLowerCase()).join(', ') + '.' };
});
const C = (slug, title, category, icon, short, description, duration, price, tutor, featured, modules, outcomes, requirements, order) => ({
  slug, title, category, icon, short_description: short, description, duration, price, currency: 'NGN', tutor_slug: tutor, featured, sort_order: order,
  image_url: courseImg(slug), modules: M(modules), outcomes, requirements, faqs: FAQ, assessment_info: ASSESS, certificate_info: CERT, published: true,
});

export const courses = [
  C('graphic-design', 'Graphic Design', 'Design', 'design', 'Learn layout, colour, typography and brand identity by producing real design briefs.',
    'This programme takes you from design principles to finished work: logos, social media kits, print layouts and a brand identity project. You will practise giving and receiving feedback and end with a portfolio you can show to clients and employers.',
    '8 weeks', 60000, 'adaeze-okafor', true,
    [['Design foundations', 'Layout and grids; Colour theory; Typography basics'], ['Tools and production', 'Vector and raster workflows; Exporting for print and web; File organisation'], ['Brand identity', 'Logo design; Brand guidelines; Social media kits'], ['Portfolio project', 'Client brief; Presentation and feedback; Portfolio publishing']],
    ['Design balanced layouts with clear hierarchy', 'Create a logo and a simple brand guideline', 'Prepare artwork for print and screens', 'Present design decisions to a client'],
    ['A laptop or desktop computer', 'Willingness to complete weekly design exercises'], 1),
  C('frontend-web-development-and-ai', 'Frontend Web Development and AI', 'Development', 'code', 'Build fast, accessible websites with HTML, CSS and JavaScript, and learn to use AI tools responsibly.',
    'Start with semantic HTML and modern CSS, move into JavaScript and APIs, then deploy real projects. The final module shows how to use AI assistants to speed up work without losing understanding of your own code.',
    '12 weeks', 120000, 'tunde-bakare', true,
    [['HTML and CSS', 'Semantic HTML; Flexbox and Grid; Responsive design'], ['JavaScript', 'Core language; DOM and events; Fetch and APIs'], ['Modern workflow', 'Git and GitHub; Component thinking; Deploying on Vercel'], ['Building with AI', 'Prompting for developers; Reviewing AI-written code; Adding AI features through APIs']],
    ['Build responsive, accessible interfaces', 'Write and debug JavaScript confidently', 'Publish projects with Git and Vercel', 'Use AI assistants to learn and ship faster'],
    ['A laptop or desktop computer', 'Basic computer skills; no coding experience needed'], 2),
  C('backend-development-and-ai', 'Backend Development and AI', 'Development', 'server', 'Design databases and secure APIs, then connect them to AI-powered features.',
    'Learn how servers, databases and APIs work together. You will model data in PostgreSQL, build authenticated APIs and integrate a language model into a working product.',
    '12 weeks', 120000, 'chinedu-eze', false,
    [['Backend fundamentals', 'HTTP and REST; Programming with JavaScript; Working with JSON'], ['Databases', 'SQL essentials; PostgreSQL; Data modelling'], ['APIs and security', 'Authentication; Authorisation; Common vulnerabilities'], ['AI integration and deployment', 'Calling AI APIs; Prompt design; Deploying and monitoring']],
    ['Design relational database schemas', 'Build and secure REST APIs', 'Integrate an AI model into an application', 'Deploy and monitor a backend service'],
    ['Basic programming knowledge is helpful', 'A laptop or desktop computer'], 3),
  C('full-stack-development', 'Full Stack Development', 'Development', 'stack', 'Combine frontend and backend skills to plan, build and launch complete web applications.',
    'A longer programme for people who want to build entire products. You will design interfaces, build the data layer, add authentication and payments-ready flows, and launch a capstone project.',
    '16 weeks', 200000, 'tunde-bakare', true,
    [['Frontend essentials', 'HTML and CSS; JavaScript; Accessibility'], ['Backend essentials', 'Databases; APIs; Authentication'], ['Product building', 'Planning features; Roles and permissions; Payments-ready flows'], ['Capstone', 'Project build; Code review; Launch and presentation']],
    ['Plan and build a complete web application', 'Implement login, roles and permissions', 'Work in a team using Git', 'Launch and present a capstone project'],
    ['Comfort using a computer', 'Commitment of about 10 hours per week'], 4),
  C('ui-ux-design', 'UI and UX Design', 'Design', 'ux', 'Research users, map journeys, prototype interfaces and test them before you build.',
    'Learn the full product design loop: understand users, sketch flows, design interfaces, prototype and run usability tests. Projects are documented as case studies for your portfolio.',
    '10 weeks', 90000, 'adaeze-okafor', true,
    [['User research', 'Interviews; Personas; Problem framing'], ['Structure and flows', 'User journeys; Information architecture; Wireframes'], ['Interface design', 'Visual hierarchy; Components and design systems; Accessibility'], ['Prototype and test', 'Interactive prototypes; Usability testing; Case study writing']],
    ['Run simple user research', 'Design wireframes and high-fidelity screens', 'Build a clickable prototype', 'Write a UX case study'],
    ['A laptop or desktop computer', 'No design experience needed'], 5),
  C('virtual-assistance', 'Virtual Assistance', 'Business', 'assist', 'Learn the tools, communication habits and client service skills of a reliable remote assistant.',
    'Cover inbox and calendar management, document preparation, research, social media support and how to find and keep remote clients.',
    '6 weeks', 50000, 'ngozi-adeyemi', false,
    [['Remote work basics', 'Professional communication; Time management; Setting up your workspace'], ['Core assistant skills', 'Email and calendar management; Documents and spreadsheets; Research'], ['Client support', 'Social media support; Customer service; Handling feedback'], ['Getting clients', 'Service packages; Pricing; Proposals and onboarding']],
    ['Manage email, calendars and documents for a client', 'Communicate clearly in remote teams', 'Package and price your services', 'Onboard a new client professionally'],
    ['A smartphone or computer with internet access'], 6),
  C('project-management', 'Project Management', 'Business', 'pm', 'Plan, track and deliver projects on time using practical methods and tools.',
    'Learn how to define scope, build schedules, manage risks and communicate with stakeholders. You will plan and run a small project from start to closure.',
    '8 weeks', 80000, 'ngozi-adeyemi', false,
    [['Project foundations', 'Project lifecycle; Scope and objectives; Stakeholders'], ['Planning', 'Work breakdown; Scheduling; Budgeting'], ['Delivery', 'Agile and Kanban; Risk management; Team communication'], ['Reporting and closure', 'Status reports; Lessons learned; Capstone plan']],
    ['Write a clear project scope and plan', 'Track progress and manage risk', 'Run team meetings and status reports', 'Close a project with a lessons-learned review'],
    ['No prior experience needed'], 7),
  C('introduction-to-data-analysis', 'Introduction to Data Analysis', 'Data', 'data', 'Clean, analyse and present data using spreadsheets and SQL.',
    'Work with real-style datasets to answer business questions. You will clean data, run analysis, build charts and present findings clearly.',
    '8 weeks', 70000, 'halima-yusuf', true,
    [['Data basics', 'Types of data; Asking good questions; Spreadsheet essentials'], ['Cleaning and preparation', 'Handling missing values; Formatting and validation; Combining sources'], ['Analysis with SQL', 'Queries and filters; Grouping and joins; Summary statistics'], ['Visualisation and storytelling', 'Choosing charts; Building dashboards; Presenting insights']],
    ['Clean messy datasets', 'Query data with SQL', 'Build clear charts and dashboards', 'Present findings to non-technical audiences'],
    ['Basic computer skills', 'Comfort with simple arithmetic'], 8),
  C('introduction-to-cybersecurity', 'Introduction to Cybersecurity', 'Security', 'shield', 'Understand common threats and learn to protect accounts, devices and small organisations.',
    'Learn how attacks work and how to defend against them. Topics include network basics, phishing, password and account security, and simple incident response.',
    '8 weeks', 80000, 'ibrahim-lawal', true,
    [['Security foundations', 'The threat landscape; Confidentiality, integrity and availability; Risk basics'], ['Networks and devices', 'How networks work; Securing devices; Wi-Fi and browsing safety'], ['People and accounts', 'Phishing and social engineering; Passwords and multi-factor authentication; Data protection'], ['Response and policy', 'Incident response basics; Writing a security policy; Capstone review']],
    ['Recognise phishing and social engineering', 'Secure accounts and devices', 'Explain core security concepts', 'Draft a simple security policy for a small team'],
    ['Basic computer skills'], 9),
  C('mental-health-and-wellness', 'Mental Health and Wellness', 'Wellbeing', 'heart', 'Build awareness of mental wellbeing and learn supportive habits for yourself and others.',
    'An awareness course covering stress, sleep, healthy routines and how to support others. It teaches when to seek professional help and does not replace clinical care.',
    '6 weeks', 40000, 'funmilayo-adebayo', false,
    [['Understanding wellbeing', 'What mental health means; Stress and coping; Myths and stigma'], ['Daily habits', 'Sleep and routine; Healthy boundaries; Managing screen time'], ['Supporting others', 'Listening skills; Recognising warning signs; Where to find professional help'], ['Workplace and community', 'Wellbeing at work; Building supportive communities; Personal action plan']],
    ['Explain common mental health terms clearly', 'Practise healthy daily routines', 'Listen and respond supportively', 'Know when and where to refer someone for professional help'],
    ['Open to reflection and discussion'], 10),
  C('child-safety-and-care', 'Child Safety and Care', 'Wellbeing', 'care', 'Learn safeguarding basics for parents, teachers and community workers.',
    'Understand child development, online safety, safe environments and how to respond to concerns responsibly. Suitable for parents, teachers, childcare workers and volunteers.',
    '6 weeks', 40000, 'funmilayo-adebayo', false,
    [['Child development', 'Stages of development; Meeting basic needs; Positive discipline'], ['Safe environments', 'Home and school safety; Supervision; Safe recruitment basics'], ['Online safety', 'Risks online; Parental controls; Talking to children about the internet'], ['Responding to concerns', 'Recognising signs of harm; Reporting routes; Record keeping']],
    ['Create safer environments for children', 'Talk to children about online risks', 'Recognise signs that a child may be at risk', 'Follow responsible reporting routes'],
    ['No prior experience needed'], 11),
];

const P = (slug, title, category, excerpt, paras, date) => ({
  slug, title, category, excerpt, author: 'Courssins Editorial', image_url: `assets/images/blog/${slug}.svg`, published: true, published_at: date,
  content: paras.map((p) => `<p>${p}</p>`).join(''),
});
export const posts = [
  P('how-to-choose-your-first-tech-skill', 'How to choose your first tech skill', 'Career Guidance', 'A simple way to compare design, development, data and security before you commit your time and money.', [
    'Most beginners ask which skill pays the most. A better first question is which kind of work you can practise for an hour every day without dreading it.',
    'Design suits people who notice details and like visual problems. Development suits people who enjoy building things that work. Data analysis suits people who like finding the answer hidden in numbers. Cybersecurity suits people who enjoy asking how something could go wrong.',
    'Pick two options and spend one weekend on a free beginner tutorial for each. Notice which one you keep thinking about afterwards. That is usually your answer.',
    'Then choose a structured programme with assignments and feedback, because steady practice with a mentor beats months of scattered videos.'], '2026-09-01T09:00:00Z'),
  P('what-a-beginner-web-development-path-looks-like', 'What a beginner web development path looks like', 'Web Development', 'From your first HTML page to a deployed project: the order that saves beginners the most time.', [
    'Start with HTML and CSS. Build three small pages by hand: a profile page, a menu for a local business and a simple landing page. Make each one work on a phone first.',
    'Move to JavaScript once layouts feel comfortable. Learn variables, functions, arrays and the DOM, then build something interactive such as a tip calculator or a to-do list.',
    'Learn Git early. Saving your work on GitHub gives you a public record of progress and makes collaboration possible.',
    'Finally, deploy. A project that lives at a real web address is worth more in an interview than ten that only run on your laptop.'], '2026-09-08T09:00:00Z'),
  P('password-habits-that-actually-protect-you', 'Password habits that actually protect you', 'Cybersecurity', 'Four everyday habits that stop most account takeovers, none of which need special software.', [
    'Use a different password for every important account. When one site is breached, attackers try the same email and password everywhere else.',
    'Prefer long passphrases over short complex ones. Four or five unrelated words are easier to remember and harder to guess.',
    'Turn on multi-factor authentication for email, banking and social media. Your email account matters most, because password resets go there.',
    'Treat unexpected links and urgent messages with suspicion, even from people you know. If a message asks you to act quickly, pause and confirm through another channel.'], '2026-09-15T09:00:00Z'),
  P('building-a-portfolio-employers-will-open', 'Building a portfolio employers will open', 'Portfolio', 'Choose fewer projects, explain your decisions, and make it easy to see your best work in a minute.', [
    'Hiring managers rarely have time to explore. Lead with your three strongest projects, not every exercise you have ever done.',
    'For each project, write a short explanation: the problem, what you did, the tools you used and the result. Show your thinking, not just the final screen.',
    'Make everything easy to open. Link directly to live projects, keep file sizes small and check your portfolio on a phone.',
    'Ask a tutor or peer to review it, then fix the first thing they mention. Repeat once a month.'], '2026-09-22T09:00:00Z'),
];

export const library = [
  { title: 'MDN: Learn web development', type: 'book', description: 'A free, structured introduction to HTML, CSS and JavaScript from Mozilla.', url: 'https://developer.mozilla.org/en-US/docs/Learn', access: 'public', cover_url: '' },
  { title: 'web.dev Learn', type: 'material', description: 'Free courses on responsive design, accessibility, performance and forms.', url: 'https://web.dev/learn', access: 'public', cover_url: '' },
  { title: 'Pro Git (free book)', type: 'book', description: 'The standard guide to Git, from first commit to advanced workflows.', url: 'https://git-scm.com/book/en/v2', access: 'public', cover_url: '' },
  { title: 'OWASP Top Ten', type: 'document', description: 'The most critical web application security risks, explained.', url: 'https://owasp.org/www-project-top-ten/', access: 'public', cover_url: '' },
  { title: 'WCAG 2.2 quick reference', type: 'document', description: 'A checklist-style reference for building accessible web content.', url: 'https://www.w3.org/WAI/WCAG22/quickref/', access: 'public', cover_url: '' },
].map((l) => ({ ...l, published: true }));

export const settings = {
  hero: { label: 'Enrolment is open', title: 'Practical tech skills, taught by working professionals.',
    text: 'Courssins Technology Institute is an online learning platform in Nigeria for digital skills training: design, development, data, security and professional skills, with mentors, assignments and verified certificates.',
    primary_text: 'Explore courses', secondary_text: 'Meet the tutors' },
  stats: [{ value: 10, suffix: '+', label: 'Professional programmes' }, { value: 99, suffix: '%', label: 'Student satisfaction' }, { value: 500, suffix: '+', label: 'Learning resources' }, { value: 600, suffix: '+', label: 'Learners reached' }],
  talent: { title: 'Talent Transformation', text: 'We combine live guidance, a purpose-built learning platform and practical projects, so learning turns into skills that employers and clients can see.',
    cards: [{ icon: 'users', title: 'Workshops', text: 'Hands-on sessions where you build with a tutor beside you.' }, { icon: 'laptop', title: 'Platform', text: 'Lessons, assignments and exams in one place, on any device.', highlight: true }, { icon: 'target', title: 'Targeting', text: 'Programmes matched to skills that are in demand.' }, { icon: 'chart', title: 'Impact', text: 'Progress tracking that shows exactly where you stand.' }] },
  why: { title: 'Why Should You Choose Courssins', text: 'Everything is designed around one outcome: helping you finish with skills you can prove.',
    cards: [{ icon: 'book', title: 'Case Studies', text: 'Learn from realistic projects that mirror day-to-day work.', href: 'courses.html', cta: 'See programmes' },
      { icon: 'globe', title: 'Learn Anywhere', text: 'Study from your phone or laptop, wherever you are.', href: 'signup.html', cta: 'Create account', active: true },
      { icon: 'chat', title: 'Discussion Session', text: 'Ask questions and compare ideas in guided group sessions.', href: 'contact.html', cta: 'Ask a question' },
      { icon: 'calendar', title: 'Schedule With Mentor', text: 'Book time with tutors for feedback on your work.', href: 'tutors.html', cta: 'Find a mentor' },
      { icon: 'award', title: 'Best Certificate', text: 'Certificates carry a unique number anyone can verify online.', href: 'certificate-verify.html', cta: 'Verify a certificate' },
      { icon: 'upload', title: 'Upload Portfolio', text: 'Submit your work for review and build a portfolio as you learn.', href: 'dashboard.html', cta: 'Open dashboard' }] },
  membership: { title: 'Join Membership And Connect To Every Member', text: 'Get course announcements, study tips and new resources in your inbox. No spam, unsubscribe any time.' },
  site: { name: 'Courssins Technology Institute', description: 'Courssins Technology Institute is an online technology and professional skills institute in Nigeria, offering practical courses taught by working professionals.',
    email: 'support.courssintech@gmail.com', phone: '', address: 'Online, Nigeria', socials: { facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/', x: 'https://x.com/', linkedin: 'https://www.linkedin.com/' } },
  certificate: { signatory: 'Director of Studies', organisation: 'Courssins Technology Institute' },
};

export const pages = [
  { slug: 'terms-and-conditions', title: 'Terms and Conditions', meta_description: 'Terms of use for Courssins Technology Institute.', published: true, css: '',
    html: '<section class="prose"><p>These terms explain how you may use the Courssins website and learning platform. By creating an account or enrolling in a programme you agree to them.</p><h2>Accounts</h2><p>You are responsible for keeping your login details private and for activity on your account.</p><h2>Enrolment and payment</h2><p>Course content unlocks after your payment has been verified. Fees and durations are shown on each course page.</p><h2>Certificates</h2><p>Certificates are issued after all lessons, assignments and examinations have been completed. Each certificate has a unique number that can be verified online.</p><h2>Acceptable use</h2><p>Do not share paid course materials, submit work that is not your own, or misuse the platform.</p><p><em>This is a starter text. Have it reviewed and edited by a qualified adviser before you rely on it.</em></p></section>' },
  { slug: 'privacy-policy', title: 'Privacy Policy', meta_description: 'How Courssins Technology Institute collects and uses personal data.', published: true, css: '',
    html: '<section class="prose"><p>This policy explains what personal information Courssins collects and how it is used.</p><h2>What we collect</h2><p>Account details you provide (name, email, phone, country), learning activity such as progress and results, and payment records.</p><h2>How we use it</h2><p>To provide your courses, issue certificates, send account and course messages, and improve the platform.</p><h2>Sharing</h2><p>We do not sell personal data. Payment processing is handled by our payment provider.</p><h2>Your choices</h2><p>You can update your details in your dashboard and unsubscribe from newsletters at any time. Contact us to request deletion of your account.</p><p><em>This is a starter text. Have it reviewed and edited by a qualified adviser before you rely on it.</em></p></section>' },
];
