import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './pool';

interface SchoolSeed {
  name: string;
  slug: string;
  departments: Array<{
    name: string;
    code: string;
    courses: Array<{ code: string; title: string; level: string }>;
  }>;
}

const SCHOOLS: SchoolSeed[] = [
  {
    name: 'College of Engineering',
    slug: 'engineering',
    departments: [
      {
        name: 'Computer Engineering',
        code: 'CPE',
        courses: [
          { code: 'CPE 201', title: 'Introduction to Computer Engineering', level: '200' },
          { code: 'CPE 301', title: 'Digital Systems Design', level: '300' },
          { code: 'CPE 401', title: 'Embedded Systems', level: '400' },
        ],
      },
      {
        name: 'Electrical & Electronics Engineering',
        code: 'EEE',
        courses: [
          { code: 'EEE 201', title: 'Circuit Theory', level: '200' },
          { code: 'EEE 305', title: 'Electromagnetic Fields', level: '300' },
          { code: 'EEE 401', title: 'Power Systems Engineering', level: '400' },
        ],
      },
      {
        name: 'Mechanical Engineering',
        code: 'MEE',
        courses: [
          { code: 'MEE 201', title: 'Engineering Mechanics', level: '200' },
          { code: 'MEE 301', title: 'Thermodynamics', level: '300' },
        ],
      },
    ],
  },
  {
    name: 'College of Science',
    slug: 'science',
    departments: [
      {
        name: 'Computer Science',
        code: 'CSC',
        courses: [
          { code: 'CSC 101', title: 'Introduction to Computing', level: '100' },
          { code: 'CSC 201', title: 'Introduction to Programming', level: '200' },
          { code: 'CSC 301', title: 'Data Structures & Algorithms', level: '300' },
          { code: 'CSC 305', title: 'Database Systems', level: '300' },
          { code: 'CSC 401', title: 'Software Engineering', level: '400' },
          { code: 'CSC 403', title: 'Artificial Intelligence', level: '400' },
        ],
      },
      {
        name: 'Microbiology',
        code: 'MCB',
        courses: [
          { code: 'MCB 201', title: 'General Microbiology', level: '200' },
          { code: 'MCB 301', title: 'Medical Microbiology', level: '300' },
        ],
      },
      {
        name: 'Mathematics',
        code: 'MTH',
        courses: [
          { code: 'MTH 101', title: 'Elementary Mathematics I', level: '100' },
          { code: 'MTH 201', title: 'Linear Algebra', level: '200' },
          { code: 'MTH 301', title: 'Real Analysis', level: '300' },
        ],
      },
      {
        name: 'Physics',
        code: 'PHY',
        courses: [
          { code: 'PHY 101', title: 'General Physics I', level: '100' },
          { code: 'PHY 201', title: 'Electricity & Magnetism', level: '200' },
        ],
      },
    ],
  },
  {
    name: 'College of Medicine',
    slug: 'medicine',
    departments: [
      {
        name: 'Medicine & Surgery',
        code: 'MED',
        courses: [
          { code: 'MED 201', title: 'Human Anatomy', level: '200' },
          { code: 'MED 301', title: 'Pathology', level: '300' },
          { code: 'MED 401', title: 'Internal Medicine', level: '400' },
        ],
      },
      {
        name: 'Nursing Science',
        code: 'NUR',
        courses: [
          { code: 'NUR 201', title: 'Fundamentals of Nursing', level: '200' },
          { code: 'NUR 301', title: 'Community Health Nursing', level: '300' },
        ],
      },
    ],
  },
  {
    name: 'College of Social Sciences',
    slug: 'social-sciences',
    departments: [
      {
        name: 'Economics',
        code: 'ECO',
        courses: [
          { code: 'ECO 101', title: 'Principles of Economics', level: '100' },
          { code: 'ECO 202', title: 'Microeconomics', level: '200' },
          { code: 'ECO 301', title: 'Macroeconomics', level: '300' },
        ],
      },
      {
        name: 'Political Science',
        code: 'POL',
        courses: [
          { code: 'POL 201', title: 'Introduction to Political Theory', level: '200' },
          { code: 'POL 301', title: 'Comparative Politics', level: '300' },
        ],
      },
      {
        name: 'Mass Communication',
        code: 'MAC',
        courses: [
          { code: 'MAC 201', title: 'News Writing & Reporting', level: '200' },
          { code: 'MAC 301', title: 'Media Law & Ethics', level: '300' },
        ],
      },
    ],
  },
  {
    name: 'College of Arts & Humanities',
    slug: 'arts-humanities',
    departments: [
      {
        name: 'English & Literature',
        code: 'ENG',
        courses: [
          { code: 'ENG 101', title: 'Introduction to Literature', level: '100' },
          { code: 'ENG 201', title: 'African Poetry', level: '200' },
          { code: 'ENG 301', title: 'Literary Criticism', level: '300' },
        ],
      },
      {
        name: 'History & International Studies',
        code: 'HIS',
        courses: [
          { code: 'HIS 201', title: 'History of West Africa', level: '200' },
          { code: 'HIS 301', title: 'International Relations', level: '300' },
        ],
      },
    ],
  },
  {
    name: 'College of Management Sciences',
    slug: 'management-sciences',
    departments: [
      {
        name: 'Accounting',
        code: 'ACC',
        courses: [
          { code: 'ACC 201', title: 'Financial Accounting', level: '200' },
          { code: 'ACC 301', title: 'Cost Accounting', level: '300' },
        ],
      },
      {
        name: 'Business Administration',
        code: 'BUS',
        courses: [
          { code: 'BUS 101', title: 'Introduction to Business', level: '100' },
          { code: 'BUS 201', title: 'Principles of Management', level: '200' },
          { code: 'BUS 301', title: 'Organisational Behaviour', level: '300' },
        ],
      },
    ],
  },
];

interface NoteSeed {
  title: string;
  description: string;
  subject: string;
  courseCode: string;
  departmentCode: string;
  level: string;
  noteType: string;
  session: string;
  authorEmail: string;
  daysAgo: number;
  views: number;
  downloads: number;
  pages: Array<{ file: string; name: string }>;
}

const SAMPLE_PAGES = [
  { file: 'note-page-1.svg', name: 'Introduction & key definitions' },
  { file: 'note-page-2.svg', name: 'Worked examples' },
  { file: 'note-page-3.svg', name: 'Revision questions' },
];

const NOTES: NoteSeed[] = [
  {
    title: 'Data Structures — Complete Lecture Notes',
    description:
      'Everything from arrays and linked lists to trees, heaps and graph traversal, with worked examples from past lectures.',
    subject: 'Data Structures & Algorithms',
    courseCode: 'CSC 301',
    departmentCode: 'CSC',
    level: '300',
    noteType: 'lecture_note',
    session: '2025/2026',
    authorEmail: 'zara@opennote.app',
    daysAgo: 1,
    views: 184,
    downloads: 42,
    pages: SAMPLE_PAGES.slice(0, 3),
  },
  {
    title: 'Database Systems — Normalisation & SQL Cheat Sheet',
    description:
      'A condensed walkthrough of 1NF–3NF, entity relationship diagrams and the SQL clauses that show up in exams.',
    subject: 'Database Systems',
    courseCode: 'CSC 305',
    departmentCode: 'CSC',
    level: '300',
    noteType: 'summary',
    session: '2025/2026',
    authorEmail: 'zara@opennote.app',
    daysAgo: 3,
    views: 121,
    downloads: 27,
    pages: [SAMPLE_PAGES[0], SAMPLE_PAGES[1]],
  },
  {
    title: 'Software Engineering — Agile, Scrum & Testing',
    description:
      'Lecture slides transcribed into clean notes, plus the agile ceremony questions that keep coming up in CSC 401 tests.',
    subject: 'Software Engineering',
    courseCode: 'CSC 401',
    departmentCode: 'CSC',
    level: '400',
    noteType: 'handout',
    session: '2025/2026',
    authorEmail: 'david@opennote.app',
    daysAgo: 4,
    views: 96,
    downloads: 18,
    pages: [SAMPLE_PAGES[1], SAMPLE_PAGES[2]],
  },
  {
    title: 'MTH 101 Past Questions (2019 – 2025)',
    description: 'Six years of past questions with a page of hints for the repeated integration questions.',
    subject: 'Elementary Mathematics I',
    courseCode: 'MTH 101',
    departmentCode: 'MTH',
    level: '100',
    noteType: 'past_question',
    session: '2024/2025',
    authorEmail: 'aisha@opennote.app',
    daysAgo: 6,
    views: 342,
    downloads: 118,
    pages: [SAMPLE_PAGES[2], SAMPLE_PAGES[0]],
  },
  {
    title: 'Human Anatomy — Upper Limb Summary',
    description:
      'Muscles, nerves and blood supply of the upper limb in a single revision sheet. Colour-coded diagrams included.',
    subject: 'Human Anatomy',
    courseCode: 'MED 201',
    departmentCode: 'MED',
    level: '200',
    noteType: 'summary',
    session: '2025/2026',
    authorEmail: 'fatima@opennote.app',
    daysAgo: 8,
    views: 218,
    downloads: 64,
    pages: [SAMPLE_PAGES[0], SAMPLE_PAGES[2]],
  },
  {
    title: 'Microeconomics — Elasticity Handout',
    description: 'Price, income and cross elasticity with graphs, formulas and two past exam questions per topic.',
    subject: 'Microeconomics',
    courseCode: 'ECO 202',
    departmentCode: 'ECO',
    level: '200',
    noteType: 'handout',
    session: '2025/2026',
    authorEmail: 'chinedu@opennote.app',
    daysAgo: 11,
    views: 87,
    downloads: 21,
    pages: [SAMPLE_PAGES[1], SAMPLE_PAGES[2]],
  },
  {
    title: 'Circuit Theory — Thevenin & Norton Worked Examples',
    description: 'Step-by-step circuit reductions, with the mistakes to avoid when finding equivalent resistance.',
    subject: 'Circuit Theory',
    courseCode: 'EEE 201',
    departmentCode: 'EEE',
    level: '200',
    noteType: 'lecture_note',
    session: '2024/2025',
    authorEmail: 'david@opennote.app',
    daysAgo: 15,
    views: 73,
    downloads: 15,
    pages: [SAMPLE_PAGES[0], SAMPLE_PAGES[1]],
  },
  {
    title: 'Financial Accounting — Trial Balance Walkthrough',
    description: 'A clean, annotated example of correcting entries and preparing a trial balance from a trial balance.',
    subject: 'Financial Accounting',
    courseCode: 'ACC 201',
    departmentCode: 'ACC',
    level: '200',
    noteType: 'summary',
    session: '2025/2026',
    authorEmail: 'grace@opennote.app',
    daysAgo: 19,
    views: 152,
    downloads: 39,
    pages: [SAMPLE_PAGES[2]],
  },
];

const ANNOUNCEMENTS = [
  {
    title: 'Second semester course registration closes this Friday',
    body:
      'The portal closes at 11:59pm on Friday. Students who have not registered for at least 15 units should visit the academic office with their adviser’s signature before Thursday. Late registration attracts a ₦5,000 fee.',
    category: 'school',
    pinned: 1,
    authorEmail: 'updates@opennote.app',
    daysAgo: 1,
  },
  {
    title: 'Free Python crash course — Saturdays, 10am in Lab B',
    body:
      'The Computer Science Society is running a five-week beginner-friendly Python course. Bring a laptop if you have one; lab machines are limited. Topics: variables, loops, functions, files and a small final project. No registration fee.',
    category: 'educational',
    pinned: 1,
    authorEmail: 'admin@opennote.app',
    daysAgo: 2,
  },
  {
    title: 'Campus print shop discount for OpenNote users',
    body:
      'MegaPrint (beside the main gate) is offering 20% off note printing for verified OpenNote users until the end of the semester. Show the note page on your phone and mention OpenNote at the counter.',
    category: 'business',
    pinned: 0,
    authorEmail: 'updates@opennote.app',
    daysAgo: 5,
  },
  {
    title: 'Library extends opening hours during exams',
    body:
      'From next Monday, the main library will open from 7am to 11pm on weekdays and 9am to 8pm on Saturdays. The silent reading floor on level 3 is reserved for final-year students during this period.',
    category: 'school',
    pinned: 0,
    authorEmail: 'updates@opennote.app',
    daysAgo: 9,
  },
  {
    title: 'Scholarship applications now open — deadline 30th',
    body:
      'The Vice-Chancellor’s merit scholarship is open to 200L–400L students with a CGPA of 3.5 and above. Application forms are available at the student affairs office. Attach your transcript and a one-page statement of purpose.',
    category: 'educational',
    pinned: 0,
    authorEmail: 'admin@opennote.app',
    daysAgo: 13,
  },
];

async function upsertSchool(name: string, slug: string): Promise<number> {
  await pool.execute(
    `INSERT INTO schools (name, slug) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), name = VALUES(name)`,
    [name, slug],
  );
  const [rows] = await pool.execute<Array<RowDataPacket & { id: number }>>('SELECT id FROM schools WHERE slug = ?', [
    slug,
  ]);
  return rows[0].id;
}

async function upsertDepartment(schoolId: number, name: string, code: string): Promise<number> {
  await pool.execute(
    `INSERT INTO departments (school_id, name, code) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), code = VALUES(code)`,
    [schoolId, name, code],
  );
  const [rows] = await pool.execute<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM departments WHERE school_id = ? AND name = ?',
    [schoolId, name],
  );
  return rows[0].id;
}

async function upsertCourse(departmentId: number, code: string, title: string, level: string): Promise<number> {
  await pool.execute(
    `INSERT INTO courses (department_id, code, title, level) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), title = VALUES(title)`,
    [departmentId, code, title, level],
  );
  const [rows] = await pool.execute<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM courses WHERE department_id = ? AND code = ? AND level = ?',
    [departmentId, code, level],
  );
  return rows[0].id;
}

async function ensureUser(input: {
  fullName: string;
  email: string;
  password: string;
  role: 'student' | 'admin' | 'superadmin';
  schoolId: number;
  departmentId: number;
  level: string | null;
  matricNo: string | null;
  bio?: string;
}): Promise<number> {
  const hash = await bcrypt.hash(input.password, 10);
  await pool.execute(
    `INSERT INTO users (full_name, email, password_hash, role, school_id, department_id, level, matric_no, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      input.fullName,
      input.email,
      hash,
      input.role,
      input.schoolId,
      input.departmentId,
      input.level,
      input.matricNo,
      input.bio ?? null,
    ],
  );
  const [rows] = await pool.execute<Array<RowDataPacket & { id: number }>>('SELECT id FROM users WHERE email = ?', [
    input.email,
  ]);
  return rows[0].id;
}

export async function seed(): Promise<void> {
  const departmentIds = new Map<string, number>();

  for (const school of SCHOOLS) {
    const schoolId = await upsertSchool(school.name, school.slug);
    for (const department of school.departments) {
      const departmentId = await upsertDepartment(schoolId, department.name, department.code);
      departmentIds.set(department.code, departmentId);
      for (const course of department.courses) {
        await upsertCourse(departmentId, course.code, course.title, course.level);
      }
    }
  }
  console.log('[seed] schools, departments and courses ready');

  const science = departmentIds.get('CSC')!;
  const engineering = departmentIds.get('CPE')!;

  const [departmentRows] = await pool.execute<Array<RowDataPacket & { id: number; school_id: number }>>(
    'SELECT id, school_id FROM departments',
  );
  const departmentSchool = new Map<number, number>(
    departmentRows.map((row) => [row.id, row.school_id]),
  );

  const users: Array<{ email: string; id: number }> = [];
  const seedUsers = [
    {
      fullName: 'Dr. Amara Okonkwo',
      email: 'admin@opennote.app',
      password: 'Admin1234!',
      role: 'superadmin' as const,
      departmentId: science,
      level: null,
      matricNo: null,
      bio: 'Faculty adviser for the OpenNote programme. Posts academic and scholarship updates.',
    },
    {
      fullName: 'Tunde Bello',
      email: 'updates@opennote.app',
      password: 'Admin1234!',
      role: 'admin' as const,
      departmentId: science,
      level: null,
      matricNo: null,
      bio: 'Student affairs desk. Campus announcements and partner offers.',
    },
    {
      fullName: 'Zara Ibrahim',
      email: 'zara@opennote.app',
      password: 'Student1234!',
      role: 'student' as const,
      departmentId: science,
      level: '300',
      matricNo: 'CSC/22/1043',
      bio: '300L Computer Science. I share clean, exam-ready notes.',
    },
    {
      fullName: 'David Mensah',
      email: 'david@opennote.app',
      password: 'Student1234!',
      role: 'student' as const,
      departmentId: engineering,
      level: '200',
      matricNo: 'CPE/24/0219',
      bio: 'Computer Engineering, class of 2028.',
    },
    {
      fullName: 'Fatima Yusuf',
      email: 'fatima@opennote.app',
      password: 'Student1234!',
      role: 'student' as const,
      departmentId: departmentIds.get('MED')!,
      level: '200',
      matricNo: 'MED/24/0311',
      bio: 'Medical student. Anatomy notes and diagrams.',
    },
    {
      fullName: 'Chinedu Eze',
      email: 'chinedu@opennote.app',
      password: 'Student1234!',
      role: 'student' as const,
      departmentId: departmentIds.get('ECO')!,
      level: '300',
      matricNo: 'ECO/22/0902',
      bio: 'Economics major, data and policy nerd.',
    },
    {
      fullName: 'Aisha Bello',
      email: 'aisha@opennote.app',
      password: 'Student1234!',
      role: 'student' as const,
      departmentId: departmentIds.get('MTH')!,
      level: '100',
      matricNo: 'MTH/25/0118',
      bio: '100L Mathematics. Past questions archivist.',
    },
    {
      fullName: 'Grace Adeyemi',
      email: 'grace@opennote.app',
      password: 'Student1234!',
      role: 'student' as const,
      departmentId: departmentIds.get('ACC')!,
      level: '300',
      matricNo: 'ACC/22/0450',
      bio: 'Accounting student. I break down tricky topics.',
    },
  ];

  for (const user of seedUsers) {
    const id = await ensureUser({
      ...user,
      schoolId: departmentSchool.get(user.departmentId)!,
    });
    users.push({ email: user.email, id });
  }
  console.log('[seed] demo accounts ready');

  const [noteCountRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM notes',
  );
  if (Number(noteCountRows[0].total) === 0) {
    for (const note of NOTES) {
      const departmentId = departmentIds.get(note.departmentCode)!;
      const [deptRows] = await pool.execute<Array<RowDataPacket & { school_id: number }>>(
        'SELECT school_id FROM departments WHERE id = ?',
        [departmentId],
      );
      const schoolId = deptRows[0].school_id;
      const [courseRows] = await pool.execute<Array<RowDataPacket & { id: number }>>(
        'SELECT id FROM courses WHERE department_id = ? AND code = ? LIMIT 1',
        [departmentId, note.courseCode],
      );
      const author = users.find((user) => user.email === note.authorEmail)!;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO notes
          (publisher_id, title, description, subject, course_code, course_id, school_id, department_id,
           level, academic_session, note_type, status, view_count, download_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [
          author.id,
          note.title,
          note.description,
          note.subject,
          note.courseCode,
          courseRows[0]?.id ?? null,
          schoolId,
          departmentId,
          note.level,
          note.session,
          note.noteType,
          note.views,
          note.downloads,
          note.daysAgo,
        ],
      );

      for (const [index, page] of note.pages.entries()) {
        await pool.execute(
          `INSERT INTO note_images (note_id, file_path, original_name, mime_type, size_bytes, sort_order)
           VALUES (?, ?, ?, 'image/svg+xml', 0, ?)`,
          [result.insertId, `/uploads/samples/${page.file}`, page.name, index],
        );
      }
    }
    console.log(`[seed] ${NOTES.length} sample notes ready`);
  } else {
    console.log('[seed] notes already exist — skipping sample notes');
  }

  const [announcementCountRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    'SELECT COUNT(*) AS total FROM announcements',
  );
  if (Number(announcementCountRows[0].total) === 0) {
    for (const announcement of ANNOUNCEMENTS) {
      const author = users.find((user) => user.email === announcement.authorEmail);
      await pool.execute(
        `INSERT INTO announcements (author_id, title, body, category, is_pinned, created_at)
         VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [author?.id ?? null, announcement.title, announcement.body, announcement.category, announcement.pinned, announcement.daysAgo],
      );
    }
    console.log(`[seed] ${ANNOUNCEMENTS.length} announcements ready`);
  } else {
    console.log('[seed] announcements already exist — skipping');
  }
}

if (require.main === module) {
  seed()
    .then(async () => {
      await pool.end();
      console.log('[seed] complete');
    })
    .catch(async (error) => {
      console.error('[seed] failed:', error);
      await pool.end();
      process.exitCode = 1;
    });
}
