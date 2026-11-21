import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { ANNOUNCEMENT_CATEGORY_VALUES, ANNOUNCEMENT_CATEGORIES } from '../lib/constants';
import { ApiError, asyncHandler, getPagination, isNumericId, paginationMeta } from '../lib/http';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth';
import { pool } from '../db/pool';

export const announcementsRouter = Router();

interface AnnouncementRow extends RowDataPacket {
  id: number;
  title: string;
  body: string;
  category: string;
  is_pinned: number;
  created_at: Date;
  updated_at: Date;
  author_id: number | null;
  author_name: string | null;
  author_role: string | null;
}

const SELECT = `
  SELECT a.id, a.title, a.body, a.category, a.is_pinned, a.created_at, a.updated_at,
         a.author_id, u.full_name AS author_name, u.role AS author_role
  FROM announcements a
  LEFT JOIN users u ON u.id = a.author_id
`;

function mapAnnouncement(row: AnnouncementRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    categoryLabel:
      ANNOUNCEMENT_CATEGORIES.find((category) => category.value === row.category)?.label ?? 'Update',
    isPinned: Boolean(row.is_pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author_id
      ? { id: row.author_id, fullName: row.author_name, role: row.author_role }
      : null,
  };
}

const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Give the update a title.').max(200),
  body: z.string().trim().min(10, 'Write the update (at least 10 characters).').max(20000),
  category: z.enum(ANNOUNCEMENT_CATEGORY_VALUES as [string, ...string[]]).default('school'),
  isPinned: z
    .preprocess((value) => value === true || value === 'true' || value === '1' || value === 1, z.boolean())
    .default(false),
});

/** GET /api/announcements — signed-in feed, pinned first. */
announcementsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query, 10, 50);
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    const category = typeof req.query.category === 'string' ? req.query.category : '';
    if (category && ANNOUNCEMENT_CATEGORY_VALUES.includes(category as (typeof ANNOUNCEMENT_CATEGORY_VALUES)[number])) {
      conditions.push('a.category = ?');
      params.push(category);
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      conditions.push('(a.title LIKE ? OR a.body LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM announcements a ${where}`,
      params,
    );

    const [rows] = await pool.query<AnnouncementRow[]>(
      `${SELECT} ${where} ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pagination.limit, pagination.offset],
    );

    res.json({
      items: rows.map(mapAnnouncement),
      meta: paginationMeta(Number(countRows[0]?.total ?? 0), pagination),
    });
  }),
);

/** GET /api/announcements/:id */
announcementsRouter.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Update not found.');
    const [rows] = await pool.execute<AnnouncementRow[]>(`${SELECT} WHERE a.id = ? LIMIT 1`, [Number(req.params.id)]);
    const row = rows[0];
    if (!row) throw new ApiError(404, 'Update not found.');
    res.json({ announcement: mapAnnouncement(row) });
  }),
);

/** POST /api/announcements — admins only. */
announcementsRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = announcementSchema.parse(req.body);
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO announcements (author_id, title, body, category, is_pinned)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user!.id, input.title, input.body, input.category, input.isPinned ? 1 : 0],
    );

    const [rows] = await pool.execute<AnnouncementRow[]>(`${SELECT} WHERE a.id = ?`, [result.insertId]);
    res.status(201).json({ announcement: mapAnnouncement(rows[0]) });
  }),
);

/** PATCH /api/announcements/:id — admins only. */
announcementsRouter.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Update not found.');
    const id = Number(req.params.id);
    const input = announcementSchema.partial().parse(req.body);

    const [existing] = await pool.execute<RowDataPacket[]>('SELECT id FROM announcements WHERE id = ? LIMIT 1', [id]);
    if (!existing[0]) throw new ApiError(404, 'Update not found.');

    const updates: string[] = [];
    const params: Array<string | number> = [];
    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.body !== undefined) {
      updates.push('body = ?');
      params.push(input.body);
    }
    if (input.category !== undefined) {
      updates.push('category = ?');
      params.push(input.category);
    }
    if (input.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(input.isPinned ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.execute(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [rows] = await pool.execute<AnnouncementRow[]>(`${SELECT} WHERE a.id = ?`, [id]);
    res.json({ announcement: mapAnnouncement(rows[0]) });
  }),
);

/** DELETE /api/announcements/:id — admins only. */
announcementsRouter.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'Update not found.');
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM announcements WHERE id = ?', [
      Number(req.params.id),
    ]);
    if (result.affectedRows === 0) throw new ApiError(404, 'Update not found.');
    res.json({ deleted: true });
  }),
);
