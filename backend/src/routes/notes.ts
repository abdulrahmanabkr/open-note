import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { config } from '../config';
import { pool } from '../db/pool';
import { LEVELS, NOTE_TYPE_VALUES, NOTE_TYPES } from '../lib/constants';
import { ApiError, asyncHandler, getPagination, isNumericId, paginationMeta } from '../lib/http';
import { optionalId } from '../lib/schemas';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { deleteUpload, normalizeNoteUploads, uploadNoteImages } from '../middleware/upload';

export const notesRouter = Router();

interface NoteRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  course_code: string | null;
  course_id: number | null;
  school_id: number | null;
  department_id: number | null;
  level: string;
  academic_session: string | null;
  note_type: string;
  status: string;
  view_count: number;
  download_count: number;
  created_at: Date;
  updated_at: Date;
  school_name: string | null;
  department_name: string | null;
  publisher_id: number;
  publisher_name: string;
  publisher_level: string | null;
  publisher_department: string | null;
  publisher_role: string;
  cover_image: string | null;
  image_count: number;
}

const NOTE_SELECT = `
  SELECT n.id, n.title, n.description, n.subject, n.course_code, n.course_id,
         n.school_id, n.department_id, n.level, n.academic_session, n.note_type, n.status,
         n.view_count, n.download_count, n.created_at, n.updated_at,
         s.name AS school_name, d.name AS department_name,
         u.id AS publisher_id, u.full_name AS publisher_name, u.level AS publisher_level,
         pd.name AS publisher_department, u.role AS publisher_role,
         (SELECT ni.file_path FROM note_images ni WHERE ni.note_id = n.id ORDER BY ni.sort_order, ni.id LIMIT 1) AS cover_image,
         (SELECT COUNT(*) FROM note_images ni2 WHERE ni2.note_id = n.id) AS image_count
  FROM notes n
  JOIN users u ON u.id = n.publisher_id
  LEFT JOIN schools s ON s.id = n.school_id
  LEFT JOIN departments d ON d.id = n.department_id
  LEFT JOIN departments pd ON pd.id = u.department_id
`;

function noteTypeLabel(value: string): string {
  return NOTE_TYPES.find((type) => type.value === value)?.label ?? 'Note';
}

function mapNote(row: NoteRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    courseCode: row.course_code,
    courseId: row.course_id,
    schoolId: row.school_id,
    schoolName: row.school_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    level: row.level,
    academicSession: row.academic_session,
    noteType: row.note_type,
    noteTypeLabel: noteTypeLabel(row.note_type),
    status: row.status,
    viewCount: row.view_count,
    downloadCount: row.download_count,
    imageCount: Number(row.image_count),
    coverImage: row.cover_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publisher: {
      id: row.publisher_id,
      fullName: row.publisher_name,
      level: row.publisher_level,
      departmentName: row.publisher_department,
      role: row.publisher_role,
    },
  };
}

const noteBodySchema = z.object({
  title: z.string().trim().min(3, 'Give the note a title.').max(200),
  description: z.string().trim().max(5000).optional(),
  subject: z.string().trim().min(2, 'Enter the subject or topic.').max(150),
  courseCode: z.string().trim().max(30).optional(),
  courseId: optionalId,
  departmentId: z.coerce.number().int().positive({ message: 'Select a department.' }),
  level: z.enum(LEVELS, { message: 'Select a level.' }),
  academicSession: z.string().trim().max(20).optional(),
  noteType: z.enum(NOTE_TYPE_VALUES as [string, ...string[]]).optional(),
});

const noteUpdateSchema = noteBodySchema.partial();

async function resolveDepartment(departmentId: number) {
  const [rows] = await pool.execute<Array<RowDataPacket & { id: number; school_id: number; name: string }>>(
    'SELECT id, school_id, name FROM departments WHERE id = ? LIMIT 1',
    [departmentId],
  );
  const department = rows[0];
  if (!department) {
    throw new ApiError(422, 'Choose a valid department.', { departmentId: 'Department not found.' });
  }
  return department;
}

async function resolveCourse(courseId: number, departmentId: number) {
  const [rows] = await pool.execute<Array<RowDataPacket & { id: number; code: string; title: string; level: string }>>(
    'SELECT id, code, title, level FROM courses WHERE id = ? AND department_id = ? LIMIT 1',
    [courseId, departmentId],
  );
  const course = rows[0];
  if (!course) {
    throw new ApiError(422, 'That course does not belong to the selected department.', {
      courseId: 'Choose a course from this department.',
    });
  }
  return course;
}

function filesOf(req: { files?: unknown }): Express.Multer.File[] {
  if (Array.isArray(req.files)) return req.files as Express.Multer.File[];
  return [];
}

function cleanupFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    fs.promises.unlink(file.path).catch(() => undefined);
  }
}

function storedPath(userId: number, file: Express.Multer.File): string {
  return `/uploads/notes/${userId}/${file.filename}`;
}

/** GET /api/notes — signed-in users, filterable list. */
notesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const conditions: string[] = ["n.status = 'published'"];
    const params: Array<string | number> = [];

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      const like = `%${q}%`;
      conditions.push('(n.title LIKE ? OR n.subject LIKE ? OR n.course_code LIKE ? OR n.description LIKE ?)');
      params.push(like, like, like, like);
    }

    const schoolId = Number(req.query.schoolId);
    if (Number.isInteger(schoolId) && schoolId > 0) {
      conditions.push('n.school_id = ?');
      params.push(schoolId);
    }

    const departmentId = Number(req.query.departmentId);
    if (Number.isInteger(departmentId) && departmentId > 0) {
      conditions.push('n.department_id = ?');
      params.push(departmentId);
    }

    const level = typeof req.query.level === 'string' ? req.query.level : '';
    if (level) {
      conditions.push('n.level = ?');
      params.push(level);
    }

    const noteType = typeof req.query.noteType === 'string' ? req.query.noteType : '';
    if (noteType && NOTE_TYPE_VALUES.includes(noteType as (typeof NOTE_TYPE_VALUES)[number])) {
      conditions.push('n.note_type = ?');
      params.push(noteType);
    }

    const courseCode = typeof req.query.courseCode === 'string' ? req.query.courseCode.trim() : '';
    if (courseCode) {
      conditions.push('n.course_code LIKE ?');
      params.push(`%${courseCode}%`);
    }

    const publisherId = Number(req.query.publisherId);
    if (Number.isInteger(publisherId) && publisherId > 0) {
      conditions.push('n.publisher_id = ?');
      params.push(publisherId);
    }

    const where = conditions.join(' AND ');

    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
    const orderBy =
      sort === 'oldest'
        ? 'n.created_at ASC'
        : sort === 'popular'
          ? 'n.view_count DESC, n.created_at DESC'
          : sort === 'downloads'
            ? 'n.download_count DESC, n.created_at DESC'
            : 'n.created_at DESC';

    const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM notes n WHERE ${where}`,
      params,
    );

    const [rows] = await pool.query<NoteRow[]>(
      `${NOTE_SELECT} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pagination.limit, pagination.offset],
    );

    res.json({
      items: rows.map(mapNote),
      meta: paginationMeta(Number(countRows[0]?.total ?? 0), pagination),
    });
  }),
);

/** GET /api/notes/mine — notes belonging to the signed-in user. */
notesRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query<NoteRow[]>(
      `${NOTE_SELECT} WHERE n.publisher_id = ? ORDER BY n.created_at DESC LIMIT 100`,
      [req.user!.id],
    );
    res.json({ items: rows.map(mapNote) });
  }),
);

/** GET /api/notes/bookmarks/mine */
notesRouter.get(
  '/bookmarks/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query<NoteRow[]>(
      `${NOTE_SELECT}
       JOIN bookmarks b ON b.note_id = n.id
       WHERE b.user_id = ? AND n.status = 'published'
       ORDER BY b.created_at DESC LIMIT 200`,
      [req.user!.id],
    );
    res.json({ items: rows.map(mapNote) });
  }),
);

/** GET /api/notes/:id — detail page, increments the view counter. */
notesRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Note not found.');

    const [rows] = await pool.query<NoteRow[]>(`${NOTE_SELECT} WHERE n.id = ? LIMIT 1`, [id]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'Note not found.');

    const canSeeHidden = req.user && (req.user.id === row.publisher_id || req.user.role !== 'student');
    if (row.status !== 'published' && !canSeeHidden) {
      throw new ApiError(404, 'Note not found.');
    }

    const [images] = await pool.execute<
      Array<RowDataPacket & { id: number; file_path: string; sort_order: number }>
    >('SELECT id, file_path, sort_order FROM note_images WHERE note_id = ? ORDER BY sort_order, id', [id]);

    let isBookmarked = false;
    if (req.user) {
      const [bookmarkRows] = await pool.execute<RowDataPacket[]>(
        'SELECT note_id FROM bookmarks WHERE user_id = ? AND note_id = ? LIMIT 1',
        [req.user.id, id],
      );
      isBookmarked = Boolean(bookmarkRows[0]);
    }

    void pool.execute('UPDATE notes SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => undefined);

    const note = mapNote(row);
    res.json({
      note: {
        ...note,
        viewCount: note.viewCount + 1,
        isBookmarked,
        images: images.map((image) => ({
          id: image.id,
          path: image.file_path,
          sortOrder: image.sort_order,
        })),
        publisher: {
          ...note.publisher,
          email: undefined,
        },
      },
    });
  }),
);

/** POST /api/notes — create a note with 1–5000 page images. */
notesRouter.post(
  '/',
  requireAuth,
  uploadNoteImages,
  normalizeNoteUploads,
  asyncHandler(async (req, res) => {
    const files = filesOf(req);

    try {
      const input = noteBodySchema.parse(req.body);
      if (files.length === 0) {
        throw new ApiError(422, 'Add at least one image of the note.', {
          images: 'At least one image is required.',
        });
      }

      const department = await resolveDepartment(input.departmentId);
      const course = input.courseId ? await resolveCourse(input.courseId, department.id) : null;

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO notes
           (publisher_id, title, description, subject, course_code, course_id, school_id, department_id,
            level, academic_session, note_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
        [
          req.user!.id,
          input.title,
          input.description || null,
          input.subject,
          input.courseCode || course?.code || null,
          course?.id ?? null,
          department.school_id,
          department.id,
          input.level,
          input.academicSession || null,
          input.noteType ?? 'lecture_note',
        ],
      );

      for (const [index, file] of files.entries()) {
        await pool.execute(
          `INSERT INTO note_images (note_id, file_path, original_name, mime_type, size_bytes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            storedPath(req.user!.id, file),
            file.originalname.slice(0, 255),
            file.mimetype,
            file.size,
            index,
          ],
        );
      }

      const [rows] = await pool.query<NoteRow[]>(`${NOTE_SELECT} WHERE n.id = ?`, [result.insertId]);
      res.status(201).json({ note: mapNote(rows[0]) });
    } catch (error) {
      cleanupFiles(files);
      throw error;
    }
  }),
);

/** PATCH /api/notes/:id — owner or admin can edit metadata and add more pages. */
notesRouter.patch(
  '/:id',
  requireAuth,
  uploadNoteImages,
  normalizeNoteUploads,
  asyncHandler(async (req, res) => {
    const files = filesOf(req);
    const id = Number(req.params.id);

    try {
      if (!isNumericId(req.params.id)) throw new ApiError(404, 'Note not found.');
      const [noteRows] = await pool.execute<Array<RowDataPacket & { publisher_id: number }>>(
        'SELECT publisher_id FROM notes WHERE id = ? LIMIT 1',
        [id],
      );
      const note = noteRows[0];
      if (!note) throw new ApiError(404, 'Note not found.');
      if (note.publisher_id !== req.user!.id && req.user!.role === 'student') {
        throw new ApiError(403, 'You can only edit your own notes.');
      }

      const input = noteUpdateSchema.parse(req.body);

      let departmentId: number | undefined;
      let schoolId: number | undefined;
      if (input.departmentId) {
        const department = await resolveDepartment(input.departmentId);
        departmentId = department.id;
        schoolId = department.school_id;
      }

      let courseId: number | null | undefined;
      let courseCode: string | undefined;
      if (input.courseId !== undefined) {
        if (input.courseId === null) {
          courseId = null;
        } else {
          const deptForCourse = departmentId ?? (
            await pool.execute<Array<RowDataPacket & { department_id: number }>>(
              'SELECT department_id FROM notes WHERE id = ?',
              [id],
            )
          )[0][0]?.department_id;
          if (!deptForCourse) throw new ApiError(422, 'Select a department first.');
          const course = await resolveCourse(input.courseId, deptForCourse);
          courseId = course.id;
          courseCode = course.code;
        }
      }
      if (input.courseCode !== undefined) courseCode = input.courseCode;

      if (files.length > 0) {
        const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
          'SELECT COUNT(*) AS total FROM note_images WHERE note_id = ?',
          [id],
        );
        if (Number(countRows[0]?.total ?? 0) + files.length > config.maxImagesPerNote) {
          throw new ApiError(422, `A note can have at most ${config.maxImagesPerNote} images.`);
        }
      }

      const updates: string[] = [];
      const params: Array<string | number | null> = [];
      const push = (column: string, value: string | number | null) => {
        updates.push(`${column} = ?`);
        params.push(value);
      };

      if (input.title !== undefined) push('title', input.title);
      if (input.description !== undefined) push('description', input.description || null);
      if (input.subject !== undefined) push('subject', input.subject);
      if (courseCode !== undefined) push('course_code', courseCode || null);
      if (courseId !== undefined) push('course_id', courseId);
      if (levelValue(input.level) !== undefined) push('level', levelValue(input.level) as string);
      if (input.academicSession !== undefined) push('academic_session', input.academicSession || null);
      if (input.noteType !== undefined) push('note_type', input.noteType);
      if (departmentId !== undefined) push('department_id', departmentId);
      if (schoolId !== undefined) push('school_id', schoolId);

      if (updates.length > 0) {
        params.push(id);
        await pool.execute(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      if (files.length > 0) {
        const [orderRows] = await pool.execute<Array<RowDataPacket & { max_order: number | null }>>(
          'SELECT MAX(sort_order) AS max_order FROM note_images WHERE note_id = ?',
          [id],
        );
        const start = Number(orderRows[0]?.max_order ?? -1) + 1;
        for (const [index, file] of files.entries()) {
          await pool.execute(
            `INSERT INTO note_images (note_id, file_path, original_name, mime_type, size_bytes, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id,
              storedPath(req.user!.id, file),
              file.originalname.slice(0, 255),
              file.mimetype,
              file.size,
              start + index,
            ],
          );
        }
      }

      const [rows] = await pool.query<NoteRow[]>(`${NOTE_SELECT} WHERE n.id = ?`, [id]);
      res.json({ note: mapNote(rows[0]) });
    } catch (error) {
      cleanupFiles(files);
      throw error;
    }
  }),
);

function levelValue(level: unknown): string | undefined {
  return typeof level === 'string' ? level : undefined;
}

/** DELETE /api/notes/:id — owner or admin. */
notesRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Note not found.');
    const id = Number(req.params.id);

    const [noteRows] = await pool.execute<Array<RowDataPacket & { publisher_id: number }>>(
      'SELECT publisher_id FROM notes WHERE id = ? LIMIT 1',
      [id],
    );
    const note = noteRows[0];
    if (!note) throw new ApiError(404, 'Note not found.');
    if (note.publisher_id !== req.user!.id && req.user!.role === 'student') {
      throw new ApiError(403, 'You can only delete your own notes.');
    }

    const [images] = await pool.execute<Array<RowDataPacket & { file_path: string }>>(
      'SELECT file_path FROM note_images WHERE note_id = ?',
      [id],
    );

    await pool.execute('DELETE FROM notes WHERE id = ?', [id]);
    for (const image of images) deleteUpload(image.file_path);

    res.json({ deleted: true });
  }),
);

/** DELETE /api/notes/:id/images/:imageId — remove a single page. */
notesRouter.delete(
  '/:id/images/:imageId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const noteId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!isNumericId(req.params.id) || !isNumericId(req.params.imageId)) {
      throw new ApiError(404, 'Image not found.');
    }

    const [noteRows] = await pool.execute<Array<RowDataPacket & { publisher_id: number }>>(
      'SELECT publisher_id FROM notes WHERE id = ? LIMIT 1',
      [noteId],
    );
    const note = noteRows[0];
    if (!note) throw new ApiError(404, 'Note not found.');
    if (note.publisher_id !== req.user!.id && req.user!.role === 'student') {
      throw new ApiError(403, 'You can only edit your own notes.');
    }

    const [imageRows] = await pool.execute<Array<RowDataPacket & { file_path: string }>>(
      'SELECT file_path FROM note_images WHERE id = ? AND note_id = ? LIMIT 1',
      [imageId, noteId],
    );
    const image = imageRows[0];
    if (!image) throw new ApiError(404, 'Image not found.');

    const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      'SELECT COUNT(*) AS total FROM note_images WHERE note_id = ?',
      [noteId],
    );
    if (Number(countRows[0]?.total ?? 0) <= 1) {
      throw new ApiError(422, 'A note needs at least one image. Delete the whole note instead.');
    }

    await pool.execute('DELETE FROM note_images WHERE id = ?', [imageId]);
    deleteUpload(image.file_path);

    res.json({ deleted: true });
  }),
);

/** GET /api/notes/:id/images/:imageId/download — save a page to disk. */
notesRouter.get(
  '/:id/images/:imageId/download',
  asyncHandler(async (req, res) => {
    const noteId = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!isNumericId(req.params.id) || !isNumericId(req.params.imageId)) {
      throw new ApiError(404, 'Image not found.');
    }

    const [rows] = await pool.execute<Array<RowDataPacket & { file_path: string }>>(
      'SELECT file_path FROM note_images WHERE id = ? AND note_id = ? LIMIT 1',
      [imageId, noteId],
    );
    const image = rows[0];
    if (!image) throw new ApiError(404, 'Image not found.');

    const absolute = path.join(config.uploadsDir, image.file_path.replace('/uploads/', ''));
    if (!absolute.startsWith(config.uploadsDir) || !fs.existsSync(absolute)) {
      throw new ApiError(404, 'Image file is missing.');
    }

    void pool.execute('UPDATE notes SET download_count = download_count + 1 WHERE id = ?', [noteId]).catch(
      () => undefined,
    );

    const extension = path.extname(absolute) || '.jpg';
    res.download(absolute, `opennote-${noteId}-page-${imageId}${extension}`);
  }),
);

/** POST /api/notes/:id/bookmark — toggle-style save. */
notesRouter.post(
  '/:id/bookmark',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Note not found.');

    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM notes WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) throw new ApiError(404, 'Note not found.');

    await pool.execute('INSERT IGNORE INTO bookmarks (user_id, note_id) VALUES (?, ?)', [req.user!.id, id]);
    res.status(201).json({ bookmarked: true });
  }),
);

notesRouter.delete(
  '/:id/bookmark',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Note not found.');
    await pool.execute('DELETE FROM bookmarks WHERE user_id = ? AND note_id = ?', [req.user!.id, id]);
    res.json({ bookmarked: false });
  }),
);
