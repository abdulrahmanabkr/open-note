import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { asyncHandler } from '../lib/http';
import { pool } from '../db/pool';

export const statsRouter = Router();

/** GET /api/stats — signed-in community counters for the landing page. */
statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<
      Array<RowDataPacket & { notes: number; students: number; departments: number; downloads: number }>
    >(
      `SELECT
         (SELECT COUNT(*) FROM notes WHERE status = 'published') AS notes,
         (SELECT COUNT(*) FROM users) AS students,
         (SELECT COUNT(*) FROM departments) AS departments,
         (SELECT COALESCE(SUM(download_count), 0) FROM notes) AS downloads`,
    );
    res.json({
      notes: Number(rows[0]?.notes ?? 0),
      students: Number(rows[0]?.students ?? 0),
      departments: Number(rows[0]?.departments ?? 0),
      downloads: Number(rows[0]?.downloads ?? 0),
    });
  }),
);
