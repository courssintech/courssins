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
    email: 'support.courssintech@gmail.com', phone: '', address: 'Online, Nigeria', socials: { facebook: 'https://www.facebook.com/', instagram: 'https://www.instagram.com/courssintechinstitute?stkn=MXNwZDM5amlrbzh2cQ==', x: 'https://x.com/', linkedin: 'https://www.linkedin.com/' } },
  certificate: { signatory: 'Director of Studies', organisation: 'Courssins Technology Institute' },
};

export const pages = [
  { slug: 'terms-and-conditions', title: 'Terms and Conditions', meta_description: 'Terms of use for Courssins Technology Institute.', published: true, css: '',
    html: `<section class="prose">
      <p><strong>Last Updated:</strong> October 7, 2026</p>
      <p>Welcome to <strong>Courssin Tech Institute</strong>. These Terms and Conditions govern your access to and use of the Courssin Tech Institute website, learning platform, courses, services, and related resources.</p>
      <p>By accessing our website, creating an account, enrolling in a course, making a payment, or using any of our services, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services.</p>
      <h2>1. About Courssin Tech Institute</h2>
      <p>Courssin Tech Institute provides technology education, digital skills training, online learning resources, courses, and related educational services.</p>
      <p>Throughout these Terms and Conditions, "Courssin Tech Institute", "Courssin", "we", "us", or "our" refers to Courssin Tech Institute.</p>
      <p>"Student", "user", "you", or "your" refers to any person who accesses our website, creates an account, enrolls in a course, or uses our services.</p>
      <h2>2. Eligibility</h2>
      <p>You must provide accurate and truthful information when creating an account or registering for a course.</p>
      <p>If you are under the age of 18, you should have the consent of a parent or legal guardian before registering for paid services or providing personal information.</p>
      <p>We reserve the right to refuse registration or access to our services where necessary.</p>
      <h2>3. User Accounts</h2>
      <p>Some features of our platform require you to create an account.</p>
      <p>You are responsible for:</p>
      <ul><li>Providing accurate registration information.</li><li>Keeping your login credentials confidential.</li><li>Maintaining the security of your account.</li><li>Not allowing unauthorized individuals to access your account.</li><li>Informing us promptly if you believe your account has been compromised.</li></ul>
      <p>You are responsible for activities carried out through your account unless the activity resulted from circumstances outside your reasonable control.</p>
      <p>We reserve the right to suspend or terminate accounts that violate these Terms and Conditions.</p>
      <h2>4. Course Enrollment</h2>
      <p>When you enroll in a Courssin Tech Institute course, you receive a personal, limited, and non-transferable right to access the course materials for educational purposes.</p>
      <p>You may not:</p>
      <ul><li>Share your account with another person.</li><li>Resell or redistribute course access.</li><li>Copy, reproduce, or commercially distribute course materials without permission.</li><li>Upload course materials to unauthorized websites or platforms.</li><li>Record or redistribute paid classes without authorization.</li><li>Use course materials to create competing commercial products without written permission.</li></ul>
      <p>Course availability, curriculum, instructors, schedules, and learning materials may be updated from time to time to improve the educational experience.</p>
      <h2>5. Payments and Fees</h2>
      <p>Where a course or service requires payment, the applicable price will be displayed before you complete your purchase.</p>
      <p>You agree to provide accurate payment information and authorize the applicable payment provider to process your payment.</p>
      <p>Prices may change from time to time. Any price change will generally apply to future purchases and will not alter a completed transaction unless required by law or otherwise communicated to you.</p>
      <p>Where applicable, taxes, transaction fees, or other charges may be added to the displayed price.</p>
      <h2>6. Refunds and Cancellations</h2>
      <p>Refund eligibility depends on the specific course or service purchased and any refund policy communicated to you at the time of purchase.</p>
      <p>Unless otherwise stated:</p>
      <ul><li>Requests for refunds should be submitted through the official Courssin Tech Institute support channel.</li><li>Refund requests may be reviewed individually.</li><li>Refunds may not be available after substantial access or completion of a course.</li><li>Administrative, payment-processing, or third-party transaction fees may be non-refundable where permitted by law.</li></ul>
      <p>Courssin Tech Institute reserves the right to establish specific refund conditions for individual courses, programs, events, or promotions.</p>
      <h2>7. Certificates</h2>
      <p>Where a course provides a certificate, eligibility may depend on meeting the requirements established for that course.</p>
      <p>Completion of a course does not automatically guarantee employment, promotion, admission to another institution, professional licensing, or any particular financial outcome.</p>
      <p>Certificates issued by Courssin Tech Institute confirm completion of the applicable Courssin educational program and should not be represented as government-issued qualifications unless expressly stated otherwise.</p>
      <h2>8. Educational Disclaimer</h2>
      <p>Our courses and educational materials are provided for learning and skills-development purposes.</p>
      <p>While we make reasonable efforts to ensure that our educational content is accurate and useful, we do not guarantee that:</p>
      <ul><li>All information will always be completely current.</li><li>A particular course will produce a specific career or financial result.</li><li>Completion of a course will guarantee employment.</li><li>Course content will meet every individual's specific educational or professional requirements.</li></ul>
      <p>Students are responsible for applying the knowledge and skills obtained from our courses appropriately.</p>
      <h2>9. Tutors and Instructors</h2>
      <p>Courssin Tech Institute may provide access to tutors, instructors, mentors, or other educational professionals.</p>
      <p>Tutors and instructors are expected to provide educational services professionally. However, individual opinions, examples, recommendations, or statements made during instruction may not necessarily represent the official position of Courssin Tech Institute.</p>
      <p>We reserve the right to change instructors, schedules, or teaching arrangements when reasonably necessary.</p>
      <h2>10. Website and Platform Usage</h2>
      <p>You agree to use our website and learning platform lawfully and responsibly.</p>
      <p>You must not:</p>
      <ul><li>Attempt to gain unauthorized access to our systems.</li><li>Introduce malware, viruses, or other harmful software.</li><li>Interfere with the operation of our website or platform.</li><li>Attempt to access another user's account.</li><li>Scrape, copy, or systematically collect website content without permission.</li><li>Use our platform for fraudulent, abusive, or unlawful activities.</li><li>Impersonate Courssin Tech Institute, its staff, tutors, or other users.</li><li>Use our services to distribute spam, malicious content, or illegal material.</li></ul>
      <p>We may restrict or terminate access where we reasonably believe that a user has violated these requirements.</p>
      <h2>11. Intellectual Property</h2>
      <p>Unless otherwise stated, the Courssin Tech Institute name, logo, website design, text, graphics, videos, course materials, documents, software, branding, and other content are owned by or licensed to Courssin Tech Institute.</p>
      <p>You may use our educational materials only for the purpose for which they are provided.</p>
      <p>You may not reproduce, modify, distribute, sell, publicly display, publish, or commercially exploit our copyrighted materials without prior written permission.</p>
      <p>Nothing in these Terms transfers ownership of Courssin Tech Institute's intellectual property to you.</p>
      <h2>12. Student-Submitted Content</h2>
      <p>If you submit assignments, projects, comments, reviews, feedback, questions, or other content to Courssin Tech Institute, you remain responsible for that content.</p>
      <p>You grant Courssin Tech Institute permission to use submitted content where reasonably necessary to operate, improve, promote, or provide our educational services, subject to applicable privacy laws and our Privacy Policy.</p>
      <p>You must not submit content that:</p>
      <ul><li>Violates another person's rights.</li><li>Contains malicious software.</li><li>Is unlawful, threatening, abusive, or defamatory.</li><li>Infringes copyright or intellectual-property rights.</li><li>Contains another person's private or confidential information without authorization.</li></ul>
      <h2>13. Student Conduct</h2>
      <p>Students are expected to behave respectfully toward tutors, staff, fellow students, and other members of the Courssin community.</p>
      <p>Harassment, bullying, discrimination, threats, abusive behavior, cheating, impersonation, fraud, or deliberate disruption of learning activities may result in suspension or termination of access.</p>
      <p>Serious violations may be reported to appropriate authorities where required or permitted by law.</p>
      <h2>14. Third-Party Services</h2>
      <p>Our website or platform may use third-party services such as payment processors, email providers, analytics services, hosting providers, authentication services, or other technology providers.</p>
      <p>Your use of such services may also be subject to the third party's terms and policies.</p>
      <p>Courssin Tech Institute is not responsible for the independent operation, availability, or policies of third-party services.</p>
      <h2>15. Privacy</h2>
      <p>We may collect and process personal information necessary to provide our services, manage accounts, process enrollments and payments, communicate with students, and improve our platform.</p>
      <p>Our collection and use of personal information are described in our <a href="page.html?slug=privacy-policy">Privacy Policy</a>.</p>
      <p>By using our services, you acknowledge that you have read and understood our Privacy Policy.</p>
      <h2>16. Website Availability</h2>
      <p>We aim to keep our website and learning platform available and reliable, but we do not guarantee uninterrupted access.</p>
      <p>The website or specific services may occasionally be unavailable due to:</p>
      <ul><li>Maintenance.</li><li>Technical problems.</li><li>Security incidents.</li><li>Internet or network failures.</li><li>Third-party service interruptions.</li><li>Circumstances beyond our reasonable control.</li></ul>
      <p>We may modify, suspend, or discontinue portions of the platform when necessary.</p>
      <h2>17. Links to Other Websites</h2>
      <p>Our website may contain links to third-party websites.</p>
      <p>These links are provided for convenience or educational purposes. Courssin Tech Institute does not necessarily endorse or control the content, security, products, or services of third-party websites.</p>
      <p>You access third-party websites at your own risk and should review their applicable terms and privacy policies.</p>
      <h2>18. Limitation of Liability</h2>
      <p>To the extent permitted by applicable law, Courssin Tech Institute will not be liable for indirect, incidental, special, consequential, or unforeseeable losses arising from your use of our website, courses, or services.</p>
      <p>We do not guarantee employment, income, business success, academic admission, certification by another organization, or any specific outcome from completing a course.</p>
      <p>Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited under applicable law.</p>
      <h2>19. Indemnification</h2>
      <p>To the extent permitted by law, you agree to be responsible for losses, claims, damages, liabilities, and reasonable expenses arising from your unlawful use of our services, violation of these Terms, or infringement of another person's rights.</p>
      <h2>20. Suspension and Termination</h2>
      <p>We may suspend or terminate your account or access to our services if you:</p>
      <ul><li>Violate these Terms and Conditions.</li><li>Engage in fraudulent or unlawful activity.</li><li>Misuse our platform or educational materials.</li><li>Share or resell unauthorized course access.</li><li>Engage in abusive or threatening conduct.</li><li>Attempt to compromise the security of our systems.</li></ul>
      <p>Where appropriate, we may provide notice before termination. However, immediate suspension may be necessary in cases involving security, fraud, serious misconduct, or legal requirements.</p>
      <h2>21. Changes to These Terms</h2>
      <p>We may update these Terms and Conditions from time to time.</p>
      <p>When changes are made, we may update the "Last Updated" date at the beginning of this document.</p>
      <p>Your continued use of our website and services after updated Terms become effective constitutes acceptance of the revised Terms.</p>
      <h2>22. Governing Law</h2>
      <p>These Terms and Conditions shall be interpreted in accordance with the applicable laws of the <strong>Federal Republic of Nigeria</strong>, unless another jurisdiction is required by applicable law.</p>
      <p>Where disputes arise, the parties should first attempt to resolve the matter through good-faith communication before pursuing formal legal remedies.</p>
      <h2>23. Severability</h2>
      <p>If any provision of these Terms and Conditions is determined to be invalid, unlawful, or unenforceable, the remaining provisions will continue to apply to the fullest extent permitted by law.</p>
      <h2>24. Entire Agreement</h2>
      <p>These Terms and Conditions, together with our Privacy Policy and any other policies expressly referenced on our platform, constitute the agreement governing your use of Courssin Tech Institute's services.</p>
      <h2>25. Contact Us</h2>
      <p>If you have questions, concerns, complaints, or requests regarding these Terms and Conditions, please contact Courssin Tech Institute through the official contact channels provided on our website.</p>
      <p><strong>Courssin Tech Institute</strong><br>Website: <a href="https://www.courssin.com.ng/">https://www.courssin.com.ng/</a></p>
      <hr>
      <p><strong>By creating an account, enrolling in a course, making a purchase, or using the Courssin Tech Institute platform, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.</strong></p>
    </section>` },
  { slug: 'privacy-policy', title: 'Privacy Policy', meta_description: 'How Courssin Tech Institute collects and uses personal information.', published: true, css: '',
    html: `<section class="prose">
      <p><strong>Last Updated:</strong> October 7, 2026</p>
      <p><strong>Courssin Tech Institute</strong> ("Courssin", "we", "us", or "our") respects your privacy and is committed to protecting the personal information of our students, tutors, visitors, and other users.</p>
      <p>This Privacy Policy explains how we collect, use, store, protect, and disclose information when you visit or use the Courssin Tech Institute website, learning platform, courses, and related services.</p>
      <p>By using our website or services, you acknowledge the practices described in this Privacy Policy.</p>
      <h2>1. Information We Collect</h2>
      <p>We may collect information that you provide directly to us when you create an account, enroll in a course, contact us, or use our services.</p>
      <p>This may include:</p>
      <h3>Account Information</h3>
      <p>When you create an account, we may collect:</p>
      <ul><li>Full name</li><li>Email address</li><li>Phone number</li><li>Username or account details</li><li>Password or authentication information</li><li>Profile photograph, where provided</li><li>Other information you choose to add to your profile</li></ul>
      <h3>Student Information</h3>
      <p>When you enroll in or participate in a course, we may collect information such as:</p>
      <ul><li>Courses you enroll in</li><li>Course progress</li><li>Assignments and submissions</li><li>Quiz or assessment results</li><li>Certificates earned</li><li>Learning activity</li><li>Tutor or instructor interactions</li><li>Feedback and reviews</li></ul>
      <h3>Payment Information</h3>
      <p>When you purchase a course or service, payment information may be processed through third-party payment providers.</p>
      <p>Depending on the payment method used, we may receive information such as:</p>
      <ul><li>Transaction reference</li><li>Payment status</li><li>Amount paid</li><li>Date of transaction</li><li>Payment method</li><li>Limited transaction information provided by the payment provider</li></ul>
      <p>We generally do not need to store your full card or bank-account credentials on our own systems when payment processing is handled by a third-party payment provider.</p>
      <h3>Communications</h3>
      <p>If you contact us, submit a form, send an email, or communicate with us through our platform, we may collect the information contained in those communications.</p>
      <h2>2. Information Collected Automatically</h2>
      <p>When you visit our website or use our platform, certain information may be collected automatically.</p>
      <p>This may include:</p>
      <ul><li>IP address</li><li>Browser type</li><li>Device type</li><li>Operating system</li><li>Pages visited</li><li>Referring website</li><li>Approximate location derived from technical information</li><li>Date and time of access</li><li>Website activity</li><li>Error and diagnostic information</li></ul>
      <p>This information helps us maintain security, understand how our website is used, and improve our services.</p>
      <h2>3. Cookies and Similar Technologies</h2>
      <p>Courssin Tech Institute may use cookies and similar technologies to operate and improve our website.</p>
      <p>Cookies may be used to:</p>
      <ul><li>Keep users signed in.</li><li>Remember preferences.</li><li>Maintain secure sessions.</li><li>Understand website usage.</li><li>Improve website performance.</li><li>Help us identify technical problems.</li></ul>
      <p>You can configure your browser to refuse or delete cookies. However, disabling certain cookies may prevent some features of the website from functioning correctly.</p>
      <h2>4. How We Use Your Information</h2>
      <p>We may use personal information to:</p>
      <ul><li>Create and manage your account.</li><li>Provide access to courses and learning materials.</li><li>Track course progress.</li><li>Process enrollments and payments.</li><li>Issue certificates.</li><li>Communicate with students and tutors.</li><li>Respond to questions and support requests.</li><li>Send account-related emails.</li><li>Send important service notifications.</li><li>Improve our courses and platform.</li><li>Detect and prevent fraud or unauthorized activity.</li><li>Protect the security of our users and systems.</li><li>Maintain and troubleshoot our website.</li><li>Comply with applicable legal obligations.</li></ul>
      <p>We will not use your personal information for purposes that are incompatible with the purposes described in this Privacy Policy unless permitted or required by applicable law.</p>
      <h2>5. Emails and Notifications</h2>
      <p>We may send emails or other communications relating to:</p>
      <ul><li>Account registration.</li><li>Email verification.</li><li>Password resets.</li><li>Course enrollment.</li><li>Course updates.</li><li>Payment confirmations.</li><li>Certificates.</li><li>Important changes to our services.</li><li>Customer support.</li></ul>
      <p>Where we send promotional or marketing communications, you may have the option to unsubscribe where applicable.</p>
      <p>Please note that certain essential service communications may still be sent because they are necessary to operate your account or provide services you requested.</p>
      <h2>6. How We Share Information</h2>
      <p>We do not sell your personal information as a business practice.</p>
      <p>We may share information with trusted third parties when reasonably necessary to provide, maintain, secure, or improve our services.</p>
      <h3>Technology and Hosting Providers</h3>
      <p>We may use third-party providers for hosting, databases, authentication, storage, email delivery, analytics, security, and other technical services.</p>
      <h3>Payment Providers</h3>
      <p>Payment information may be processed by third-party payment providers to complete transactions.</p>
      <h3>Tutors and Instructors</h3>
      <p>Information necessary to provide educational services may be made available to relevant tutors or instructors.</p>
      <h3>Legal and Regulatory Authorities</h3>
      <p>We may disclose information where required by law, court order, legal process, or where necessary to protect our rights, users, property, or security.</p>
      <h3>Business Transfers</h3>
      <p>If Courssin Tech Institute is involved in a merger, acquisition, restructuring, sale of assets, or similar transaction, personal information may be transferred as part of that transaction, subject to applicable law.</p>
      <h2>7. Third-Party Services</h2>
      <p>Our platform may use third-party services to operate certain features.</p>
      <p>These may include services for:</p>
      <ul><li>Authentication</li><li>Database management</li><li>Cloud storage</li><li>Payment processing</li><li>Email delivery</li><li>Analytics</li><li>Website hosting</li><li>Security</li><li>Customer support</li></ul>
      <p>These providers may process information according to their own privacy policies and contractual obligations.</p>
      <p>Where our platform uses a third-party service, we encourage users to review the applicable provider's privacy policy where appropriate.</p>
      <h2>8. Supabase and Authentication</h2>
      <p>Courssin Tech Institute may use <strong>Supabase</strong> or similar technology providers for database, authentication, storage, and related platform functionality.</p>
      <p>Information associated with your account may therefore be processed through these services to provide secure authentication and operate our learning platform.</p>
      <p>We configure and use third-party services according to the needs of our platform and applicable security and privacy requirements.</p>
      <h2>9. How We Protect Your Information</h2>
      <p>We take reasonable technical and organizational measures to protect personal information against unauthorized access, alteration, disclosure, loss, or destruction.</p>
      <p>Security measures may include:</p>
      <ul><li>Secure authentication.</li><li>Access controls.</li><li>Password protection.</li><li>Encryption where appropriate.</li><li>Restricted administrative access.</li><li>Security monitoring.</li><li>Regular maintenance and updates.</li></ul>
      <p>However, no internet transmission or electronic storage system can be guaranteed to be completely secure.</p>
      <p>You are also responsible for protecting your account credentials and should not share your password with anyone.</p>
      <h2>10. How Long We Keep Information</h2>
      <p>We retain personal information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including:</p>
      <ul><li>Providing our services.</li><li>Maintaining student records.</li><li>Managing accounts.</li><li>Processing transactions.</li><li>Resolving disputes.</li><li>Preventing fraud.</li><li>Meeting legal, accounting, or regulatory obligations.</li></ul>
      <p>When information is no longer reasonably required, we may delete, anonymize, or securely dispose of it, subject to applicable legal requirements.</p>
      <h2>11. Your Privacy Rights</h2>
      <p>Depending on applicable law, you may have rights relating to your personal information.</p>
      <p>These may include the right to:</p>
      <ul><li>Request access to personal information we hold about you.</li><li>Request correction of inaccurate information.</li><li>Request deletion of certain information.</li><li>Request restriction of certain processing.</li><li>Object to certain uses of your information.</li><li>Withdraw consent where processing is based on consent.</li><li>Request information about how your personal information is processed.</li><li>Lodge a complaint with an appropriate data protection authority where applicable.</li></ul>
      <p>Some requests may be subject to legal or contractual limitations.</p>
      <p>To exercise a privacy right, contact us using the official contact details provided on our website.</p>
      <h2>12. Children's Privacy</h2>
      <p>Our services are not intended to encourage children to provide personal information without appropriate supervision.</p>
      <p>Where a user is under the age of 18, we recommend that a parent or legal guardian be involved in the registration and use of our services where required or appropriate.</p>
      <p>If we become aware that personal information has been collected from a child in circumstances where appropriate consent was required but not obtained, we may take reasonable steps to delete that information.</p>
      <h2>13. Student and Educational Records</h2>
      <p>Information relating to a student's enrollment, progress, assignments, assessments, and certificates may be retained as part of the student's educational record.</p>
      <p>We may use this information to:</p>
      <ul><li>Provide educational services.</li><li>Monitor course progress.</li><li>Verify course completion.</li><li>Issue certificates.</li><li>Provide student support.</li><li>Improve our educational programs.</li></ul>
      <p>We will take reasonable measures to restrict access to educational records to authorized individuals.</p>
      <h2>14. User-Generated Content</h2>
      <p>Users may submit information such as assignments, comments, reviews, questions, projects, profile information, or other content.</p>
      <p>Please avoid submitting sensitive personal information that is not necessary for your participation in our services.</p>
      <p>Content posted publicly or shared with other users may be visible to those users. You should consider this before submitting information to areas of the platform that are designed for public or community interaction.</p>
      <h2>15. Links to Other Websites</h2>
      <p>Our website may contain links to third-party websites.</p>
      <p>We are not responsible for the privacy practices, security, or content of websites operated by third parties.</p>
      <p>We encourage you to review the privacy policies of external websites before providing them with personal information.</p>
      <h2>16. International Data Processing</h2>
      <p>Some service providers we use may process or store information in countries outside Nigeria.</p>
      <p>Where personal information is transferred internationally, we will seek to do so in accordance with applicable data protection requirements and take reasonable steps to protect the information.</p>
      <h2>17. Data Protection in Nigeria</h2>
      <p>Courssin Tech Institute intends to handle personal information in accordance with applicable Nigerian data protection requirements, including the <strong>Nigeria Data Protection Act 2023</strong>, where applicable.</p>
      <p>Where required, we will take appropriate measures relating to lawful processing, transparency, data security, retention, and individual privacy rights.</p>
      <h2>18. Changes to This Privacy Policy</h2>
      <p>We may update this Privacy Policy from time to time to reflect changes in our services, technology, legal requirements, or privacy practices.</p>
      <p>When we make changes, we will update the <strong>"Last Updated"</strong> date at the beginning of this Privacy Policy.</p>
      <p>We encourage you to review this page periodically.</p>
      <h2>19. Contact Us</h2>
      <p>If you have questions about this Privacy Policy, want to exercise a privacy right, or have concerns about how your information is handled, please contact Courssin Tech Institute through the official contact channels provided on our website.</p>
      <p><strong>Courssin Tech Institute</strong><br>Website: <a href="https://www.courssin.com.ng/">https://www.courssin.com.ng/</a></p>
      <hr>
      <p><strong>By using the Courssin Tech Institute website and services, you acknowledge that you have read and understood this Privacy Policy.</strong></p>
    </section>` },
];
