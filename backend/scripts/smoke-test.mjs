/**
 * OpenNote API smoke test.
 *
 * Start the API first, then run:
 *   API_URL=http://localhost:4000 npm run smoke
 *
 * It creates a temporary student + note + announcement and cleans them up.
 */
const BASE = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const API = `${BASE}/api`;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
function pageForm(extra = {}) {
  const form = new FormData();
  form.append('images', new Blob([png], { type: 'image/png' }), 'page.png');
  for (const [key, value] of Object.entries(extra)) form.append(key, String(value));
  return form;
}

const health = await call('/health');
check('health endpoint', health.status === 200 && health.data?.status === 'ok');

const login = await call('/auth/login', {
  method: 'POST',
  body: { email: 'zara@opennote.app', password: 'Student1234!' },
});
check('seed student can log in', login.status === 200 && Boolean(login.data?.token));
const student = login.data?.token;

const wrong = await call('/auth/login', {
  method: 'POST',
  body: { email: 'zara@opennote.app', password: 'bad-password' },
});
check('wrong password is rejected', wrong.status === 401);

const email = `smoke${Date.now()}@opennote.app`;
const registered = await call('/auth/register', {
  method: 'POST',
  body: {
    fullName: 'Smoke Tester',
    email,
    password: 'Testing1234!',
    schoolId: 2,
    departmentId: 4,
    level: '300',
    matricNo: 'CSC/25/0001',
  },
});
check(
  'registration returns profile + token',
  registered.status === 201 && registered.data?.user?.departmentName === 'Computer Science',
);
const tester = registered.data?.token;

check(
  'duplicate email rejected',
  (await call('/auth/register', { method: 'POST', body: { fullName: 'Copy', email, password: 'Testing1234!' } }))
    .status === 409,
);

const me = await call('/auth/me', { token: tester });
check('auth/me works', me.status === 200 && me.data?.user?.email === email);

const profile = await call('/auth/me', {
  method: 'PATCH',
  token: tester,
  body: { fullName: 'Smoke Tester Updated', level: '400', bio: 'Testing.' },
});
check('profile update', profile.status === 200 && profile.data?.user?.level === '400');

const list = await call('/notes?limit=3');
check(
  'notes list is paginated',
  list.status === 200 && list.data?.items?.length === 3 && list.data?.meta?.total >= 8,
);

const filtered = await call('/notes?departmentId=4&level=300&q=CSC&limit=20');
check(
  'department + level + text filters',
  filtered.status === 200 &&
    filtered.data.items.length > 0 &&
    filtered.data.items.every((note) => note.departmentId === 4 && note.level === '300'),
);

const detail = await call('/notes/1');
check(
  'note detail contains publisher, time and images',
  detail.status === 200 &&
    detail.data?.note?.images?.length === 3 &&
    detail.data?.note?.publisher?.fullName === 'Zara Ibrahim' &&
    Boolean(detail.data?.note?.createdAt),
);

check('unknown note returns 404', (await call('/notes/999999')).status === 404);

const created = await call('/notes', {
  method: 'POST',
  token: tester,
  body: pageForm({
    title: 'Smoke test note',
    subject: 'API Testing',
    departmentId: 4,
    level: '400',
    courseCode: 'CSC 499',
    noteType: 'summary',
  }),
});
const noteId = created.data?.note?.id;
check('create note with image', created.status === 201 && created.data?.note?.imageCount === 1);

const uploaded = await call(`/notes/${noteId}`);
const imagePath = uploaded.data?.note?.images?.[0]?.path;
check(
  'uploaded image is served',
  Boolean(imagePath) && (await fetch(`${BASE}${imagePath}`)).status === 200,
);

check(
  'student cannot edit another publisher’s note',
  (await call(`/notes/${noteId}`, { method: 'PATCH', token: student, body: { title: 'Hijacked' } })).status === 403,
);

const edit = new FormData();
edit.append('title', 'Smoke test note — edited');
check(
  'owner can edit note',
  (await call(`/notes/${noteId}`, { method: 'PATCH', token: tester, body: edit })).status === 200,
);

check(
  'owner can add a page',
  (await call(`/notes/${noteId}`, { method: 'PATCH', token: tester, body: pageForm({ noteType: 'handout' }) })).data
    ?.note?.imageCount === 2,
);

const download = await fetch(
  `${API}/notes/${noteId}/images/${uploaded.data?.note?.images?.[0]?.id}/download`,
);
check('single page download', download.status === 200 && download.headers.get('content-type')?.includes('image'));

check(
  'bookmark + saved list',
  (await call(`/notes/${noteId}/bookmark`, { method: 'POST', token: tester })).status === 201 &&
    (await call('/notes/bookmarks/mine', { token: tester })).data?.items?.some((note) => note.id === noteId),
);
check(
  'remove bookmark',
  (await call(`/notes/${noteId}/bookmark`, { method: 'DELETE', token: tester })).status === 200 &&
    !(await call('/notes/bookmarks/mine', { token: tester })).data?.items?.some((note) => note.id === noteId),
);

check('my notes list', (await call('/notes/mine', { token: tester })).data?.items?.some((note) => note.id === noteId));

const noImages = new FormData();
noImages.append('title', 'No pages');
noImages.append('subject', 'Empty');
noImages.append('departmentId', '4');
noImages.append('level', '300');
check('note without images rejected', (await call('/notes', { method: 'POST', token: tester, body: noImages })).status === 422);

check(
  'students cannot publish announcements',
  (
    await call('/announcements', {
      method: 'POST',
      token: tester,
      body: { title: 'Nope', body: 'Students cannot publish this.', category: 'school' },
    })
  ).status === 403,
);

const adminLogin = await call('/auth/login', {
  method: 'POST',
  body: { email: 'admin@opennote.app', password: 'Admin1234!' },
});
check('superadmin can log in', adminLogin.status === 200 && adminLogin.data?.user?.role === 'superadmin');
const admin = adminLogin.data?.token;

const feed = await call('/announcements?limit=5');
check('announcements feed + pinned first', feed.status === 200 && feed.data?.items?.[0]?.isPinned === true);

const announcement = await call('/announcements', {
  method: 'POST',
  token: admin,
  body: { title: 'Smoke test update', body: 'Temporary announcement created by the smoke test.', category: 'business' },
});
const announcementId = announcement.data?.announcement?.id;
check('admin creates announcement', announcement.status === 201);

check(
  'admin edits announcement',
  (
    await call(`/announcements/${announcementId}`, {
      method: 'PATCH',
      token: admin,
      body: { isPinned: true },
    })
  ).data?.announcement?.isPinned === true,
);
check(
  'admin deletes announcement',
  (await call(`/announcements/${announcementId}`, { method: 'DELETE', token: admin })).status === 200,
);

check('admin stats', (await call('/admin/stats', { token: admin })).status === 200);
check('students blocked from admin routes', (await call('/admin/stats', { token: tester })).status === 403);

const users = await call('/admin/users?limit=50', { token: admin });
const testerUser = users.data?.items?.find((person) => person.email === email);
check('admin user directory', users.status === 200 && Boolean(testerUser));
check(
  'superadmin changes roles',
  (
    await call(`/admin/users/${testerUser.id}/role`, {
      method: 'PATCH',
      token: admin,
      body: { role: 'admin' },
    })
  ).data?.user?.role === 'admin',
);

check('owner deletes note', (await call(`/notes/${noteId}`, { method: 'DELETE', token: tester })).status === 200);
check('deleted note is gone', (await call(`/notes/${noteId}`)).status === 404);
await call(`/admin/users/${testerUser.id}`, { method: 'DELETE', token: admin });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
