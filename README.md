# OpenNote

A campus note-sharing platform where students publish lecture notes, handouts and past questions as page images, and every student on campus can find and read them. A separate admin noticeboard carries school, educational and business updates.

Built with **React + TypeScript** (frontend), **Node.js + Express** (backend) and **MySQL 8** (database).

---

## What is included

### For students
- **Email + password accounts** with hashed passwords and JWT sessions.
- **Post a note** with 1–5000 pages from JPG, PNG, WEBP, GIF, AVIF, TIFF, BMP or PDF files (images up to 8 MB, PDFs up to 50 MB), described by title, subject, course code, department, level, session and note type. PDFs and multi-page TIFFs are split into one page image per page.
- **Publisher attribution** on every note: full name, class/level, department and the exact publish time.
- **Browse and filter** by school/faculty, department, level and note type, plus free-text search across titles, subjects, course codes and descriptions. Sort by newest, oldest, most viewed or most downloaded.
- **Read notes page by page** in the browser, with a full-screen lightbox, page downloads and shareable links.
- **Save/bookmark** notes and revisit them from a personal dashboard.
- **Manage your own notes**: edit details, add pages, remove pages or delete the note.
- **Profile page** to keep name, school, department, level, matric number and bio current.

### For admins
- **Three roles**: `student`, `admin`, `superadmin`.
- **Announcement publishing** with categories (school update, educational, business) and pinning.
- **Admin overview** with community stats and the latest uploads.
- **User directory** with search and role filters. Superadmins can promote/demote users and delete accounts.
- **Moderation on demand**: admins can edit or delete any note.

### Design & UX
- Editorial, responsive interface (Fraunces + Inter) that works from phone to desktop.
- URL-driven filters, so a search result can be bookmarked or shared.
- Accessible forms with inline validation, toasts for feedback and friendly empty/error states.
- Seeded demo content (8 notes, 5 announcements, 8 accounts) and local sample note pages.

---

## Quick start

### 1. Requirements
- Node.js **20+** (tested on Node 24)
- MySQL **8+**, or Docker for the included MySQL container

### 2. Install dependencies
From the project root:

```bash
npm install
npm run install:all
```

### 3. Configure the environment

```bash
cp backend/.env.example backend/.env
```

The defaults match `docker-compose.yml`. **Change `JWT_SECRET` before deploying.**

The frontend reads `VITE_API_URL` (defaults to `http://localhost:4000/api`). To override:

```bash
cp frontend/.env.example frontend/.env
```

### 4. Start MySQL

With Docker:

```bash
docker compose up -d mysql
```

Or use an existing MySQL server and create a database/user:

```sql
CREATE DATABASE opennote CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'opennote'@'localhost' IDENTIFIED BY 'opennote';
GRANT ALL PRIVILEGES ON opennote.* TO 'opennote'@'localhost';
FLUSH PRIVILEGES;
```

Then set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` in `backend/.env`.

### 5. Create the schema and seed demo data

```bash
npm run db:init
```

This is safe to re-run: tables use `IF NOT EXISTS` and the seeder skips content that already exists. To seed only:

```bash
npm run db:seed
```

### 6. Run both apps

```bash
npm run dev
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:4000/api>
- Health check: <http://localhost:4000/api/health>

Or run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Superadmin | `admin@opennote.app` | `Admin1234!` |
| Admin | `updates@opennote.app` | `Admin1234!` |
| Student | `zara@opennote.app` | `Student1234!` |
| Student | `david@opennote.app` | `Student1234!` |
| Student | `fatima@opennote.app` | `Student1234!` |

The login screen has buttons that fill the student and admin demo credentials for you.

---

## Project structure

```
open-note/
├── backend/
│   ├── src/
│   │   ├── config.ts              # env + upload limits
│   │   ├── index.ts               # express app, CORS, static uploads
│   │   ├── db/
│   │   │   ├── schema.sql         # MySQL tables
│   │   │   ├── pool.ts            # mysql2 pool
│   │   │   ├── init.ts            # create DB + apply schema + seed
│   │   │   └── seed.ts            # schools, courses, accounts, notes, updates
│   │   ├── lib/                   # http helpers, jwt, zod schemas, users
│   │   ├── middleware/            # auth/roles, multer uploads
│   │   └── routes/                # auth, notes, announcements, taxonomy, admin, stats
│   ├── uploads/
│   │   ├── notes/                 # runtime user uploads (gitignored)
│   │   └── samples/               # seeded sample note pages
│   └── scripts/smoke-test.mjs     # end-to-end API smoke test
├── frontend/
│   └── src/
│       ├── api/                   # fetch client + shared types
│       ├── components/            # layout, cards, filters, viewer, icons…
│       ├── context/               # auth + toast providers
│       ├── pages/                 # home, note detail, post, dashboard, admin…
│       ├── lib/format.ts          # dates, levels, numbers
│       └── index.css              # design system
├── docker-compose.yml             # MySQL 8.4
└── package.json                   # convenience scripts
```

---

## How the main flows work

### Publishing a note
1. The student picks 1–5000 images or PDFs and fills in the course details.
2. The browser sends `multipart/form-data` to `POST /api/notes`.
3. Multer stores uploads in `backend/uploads/notes/<userId>/`. PDFs, multi-page TIFFs and BMP files are rendered into one PNG per page, then the originals are removed.
4. MySQL stores the relative paths of the resulting page images.

### Publisher details
Every note response joins the publisher row and returns:

```json
"publisher": {
  "id": 3,
  "fullName": "Zara Ibrahim",
  "level": "300",
  "departmentName": "Computer Science",
  "role": "student"
}
```

The note also carries `createdAt`; the UI shows both a relative time (“2 days ago”) and the exact date/time.

### Filtering
`GET /api/notes` accepts:

| Param | Example | Notes |
| --- | --- | --- |
| `q` | `CSC 301` | Searches title, subject, course code and description |
| `schoolId` | `2` | Faculty / college |
| `departmentId` | `4` | Department |
| `level` | `300` | Stored as `100`…`700`, displayed as `100L`…`700L` |
| `noteType` | `past_question` | `lecture_note`, `handout`, `past_question`, `summary`, `textbook`, `other` |
| `courseCode` | `CSC 301` | Partial match |
| `publisherId` | `3` | Notes by one publisher |
| `sort` | `newest` | `newest`, `oldest`, `popular`, `downloads` |
| `page`, `limit` | `2`, `12` | Pagination |

All filters combine with AND and are mirrored in the URL on the frontend.

---

## API reference

Base URL: `http://localhost:4000/api`  
Authenticated requests use `Authorization: Bearer <jwt>`.

Everything except `POST /auth/register`, `POST /auth/login` and `/taxonomy` requires a signed-in user. The web app mirrors this: only `/login` and `/register` are reachable without a session; every other page redirects to the login screen.

### Auth
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Create a student account |
| POST | `/auth/login` | public | Email/password login |
| GET | `/auth/me` | auth | Current profile |
| PATCH | `/auth/me` | auth | Update profile/class details |

### Notes
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/notes` | auth | Filtered, paginated list |
| GET | `/notes/:id` | auth | Detail + images + publisher, increments views |
| POST | `/notes` | auth | Create note (multipart, field `images`) |
| PATCH | `/notes/:id` | owner/admin | Edit metadata, add pages |
| DELETE | `/notes/:id` | owner/admin | Delete note and its files |
| DELETE | `/notes/:id/images/:imageId` | owner/admin | Remove one page |
| GET | `/notes/:id/images/:imageId/download` | public | Download a page |
| GET | `/notes/mine` | auth | Your notes |
| GET | `/notes/bookmarks/mine` | auth | Saved notes |
| POST/DELETE | `/notes/:id/bookmark` | auth | Save/unsave |

### Announcements
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/announcements` | auth | Feed (pinned first); filters `category`, `q` |
| GET | `/announcements/:id` | auth | Single update |
| POST | `/announcements` | admin | Publish an update |
| PATCH | `/announcements/:id` | admin | Edit/pin |
| DELETE | `/announcements/:id` | admin | Delete |

### Reference data & administration
| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/taxonomy` | public | Schools, departments, levels, note types |
| GET | `/taxonomy/courses` | public | Courses by department/level |
| GET | `/stats` | auth | Landing-page counters |
| GET | `/admin/stats` | admin | Dashboard counters + latest notes |
| GET | `/admin/users` | admin | User directory (search/filter/paginate) |
| PATCH | `/admin/users/:id/role` | superadmin | Change a role |
| DELETE | `/admin/users/:id` | superadmin | Delete an account and its notes |

Uploads are served from `GET /uploads/...`.

---

## Database model

- `schools` → `departments` → `courses`
- `users` (role, school, department, level, matric number, bio)
- `notes` (publisher, department/school/course, level, session, type, views, downloads, timestamps)
- `note_images` (one row per page, ordered)
- `announcements` (category, pinned flag, author)
- `bookmarks` (user ↔ note)

The full schema is in [`backend/src/db/schema.sql`](backend/src/db/schema.sql).

---

## Scripts

### Root
| Command | What it does |
| --- | --- |
| `npm run install:all` | Install backend + frontend dependencies |
| `npm run db:init` | Create database, apply schema, seed |
| `npm run db:seed` | Seed demo content only |
| `npm run dev` | Run API + web app together |
| `npm run build` | Type-check/build both apps |
| `npm start` | Run the compiled API |

### Backend
| Command | What it does |
| --- | --- |
| `npm run dev` | API with hot reload (tsx) |
| `npm run typecheck` | TypeScript check |
| `npm run smoke` | End-to-end API test (API must be running) |
| `npm run build` / `npm start` | Compile to `dist/` / run compiled API |

### Frontend
| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |

Run the smoke test after starting the API:

```bash
cd backend
API_URL=http://localhost:4000 node scripts/smoke-test.mjs
```

It creates a temporary student, note and announcement, verifies permissions, uploads, downloads, bookmarks and admin routes, then deletes everything it created.

---

## Production notes

- Set a strong, unique `JWT_SECRET`; changing it signs everyone out.
- Set `CLIENT_ORIGIN` to the deployed frontend URL (comma-separate multiple origins).
- Serve the built frontend from any static host; point `VITE_API_URL` at the public API and rebuild.
- For multiple API instances, move `backend/uploads` to shared/object storage. The DB stores paths, so only the storage layer needs changing.
- Add HTTPS, rate limiting and a process manager (systemd/PM2) before public use.
- Uploaded files are validated by MIME type, extension and size. Accepted formats are JPG, PNG, WEBP, GIF, AVIF, TIFF, BMP and PDF. Non-browser formats (PDF, TIFF, BMP) are converted to PNG page images with MuPDF before being stored. SVGs are used only for seeded sample pages.
- Notes publish immediately by design. If you later want moderation, add a review status and an admin queue — the `notes.status` column already supports `published`/`hidden`.

---

## Troubleshooting

**“Could not reach the server”** — the API is not running or `VITE_API_URL` is wrong. Check <http://localhost:4000/api/health>.

**`ER_ACCESS_DENIED_ERROR` during `db:init`** — the credentials in `backend/.env` do not match your MySQL server. With Docker, the defaults work; otherwise create the user with the SQL above.

**Images do not load** — make sure the API is on port 4000 and that `backend/uploads/notes` exists (it is created at startup). Seeded samples live in `backend/uploads/samples`.

**CORS error** — add the frontend origin to `CLIENT_ORIGIN` in `backend/.env` (comma-separated) and restart the API.

**Port already in use** — change `PORT` in `backend/.env` and `VITE_API_URL` in `frontend/.env` to match.
