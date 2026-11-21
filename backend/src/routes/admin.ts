import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { ApiError, asyncHandler, getPagination, isNumericId, paginationMeta } from '../lib/http';
import { requireAuth, requireRole } from '../middleware/auth';
import { pool } from '../db/pool';
import { mapUser, USER_SELECT, type UserRow } from '../lib/users';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin', 'superadmin'));

/** GET /api/admin/stats — dashboard counters. */
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<
      Array<RowDataPacket & { students: number; admins: number; notes: number; announcements: number }>
    >(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
         (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'superadmin')) AS admins,
         (SELECT COUNT(*) FROM notes) AS notes,
         (SELECT COUNT(*) FROM announcements) AS announcements`,
    );
    const [totals] = await pool.query<Array<RowDataPacket & { downloads: number; views: number }>>(
      'SELECT COALESCE(SUM(download_count), 0) AS downloads, COALESCE(SUM(view_count), 0) AS views FROM notes',
    );
    const [latest] = await pool.query<
      Array<RowDataPacket & { id: number; title: string; created_at: Date; publisher_name: string }>
    >(
      `SELECT n.id, n.title, n.created_at, u.full_name AS publisher_name
       FROM notes n JOIN users u ON u.id = n.publisher_id
       ORDER BY n.created_at DESC LIMIT 5`,
    );

    res.json({
      stats: {
        students: Number(rows[0]?.students ?? 0),
        admins: Number(rows[0]?.admins ?? 0),
        notes: Number(rows[0]?.notes ?? 0),
        announcements: Number(rows[0]?.announcements ?? 0),
        downloads: Number(totals[0]?.downloads ?? 0),
        views: Number(totals[0]?.views ?? 0),
      },
      latestNotes: latest.map((note) => ({
        id: note.id,
        title: note.title,
        createdAt: note.created_at,
        publisherName: note.publisher_name,
      })),
    });
  }),
);

/** GET /api/admin/users?q=&role=&page= */
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query, 20, 100);
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.matric_no LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const role = typeof req.query.role === 'string' ? req.query.role : '';
    if (role === 'student' || role === 'admin' || role === 'superadmin') {
      conditions.push('u.role = ?');
      params.push(role);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params,
    );
    const [rows] = await pool.query<UserRow[]>(
      `${USER_SELECT} ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pagination.limit, pagination.offset],
    );

    res.json({
      items: rows.map(mapUser),
      meta: paginationMeta(Number(countRows[0]?.total ?? 0), pagination),
    });
  }),
);

/** PATCH /api/admin/users/:id/role — superadmin only. */
adminRouter.patch(
  '/users/:id/role',
  requireRole('superadmin'),
  asyncHandler(async (req, res) => {
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'User not found.');
    const id = Number(req.params.id);
    const input = z.object({ role: z.enum(['student', 'admin', 'superadmin']) }).parse(req.body);

    if (id === req.user!.id && input.role !== 'superadmin') {
      throw new ApiError(422, 'You cannot remove your own superadmin role.');
    }

    const [result] = await pool.execute<ResultSetHeader>('UPDATE users SET role = ? WHERE id = ?', [
      input.role,
      id,
    ]);
    if (result.affectedRows === 0) throw new ApiError(404, 'User not found.');

    const [rows] = await pool.query<UserRow[]>(`${USER_SELECT} WHERE u.id = ?`, [id]);
    res.json({ user: mapUser(rows[0]) });
  }),
);

/** DELETE /api/admin/users/:id — superadmin only. */
adminRouter.delete(
  '/users/:id',
  requireRole('superadmin'),
  asyncHandler(async (req, res) => {
    if (!isNumericId(req.params.id)) throw new ApiError(404, 'User not found.');
    const id = Number(req.params.id);
    if (id === req.user!.id) throw new ApiError(422, 'You cannot delete your own account.');

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) throw new ApiError(404, 'User not found.');
    res.json({ deleted: true });
  }),
);
