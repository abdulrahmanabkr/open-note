import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { ANNOUNCEMENT_CATEGORIES, LEVELS, NOTE_TYPES } from '../lib/constants';
import { asyncHandler } from '../lib/http';
import { pool } from '../db/pool';

export const taxonomyRouter = Router();

interface SchoolRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
}

interface DepartmentRow extends RowDataPacket {
  id: number;
  name: string;
  code: string;
  school_id: number;
}

/** GET /api/taxonomy — everything the filter bar and forms need. */
taxonomyRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [schools] = await pool.execute<SchoolRow[]>('SELECT id, name, slug FROM schools ORDER BY name');
    const [departments] = await pool.execute<DepartmentRow[]>(
      'SELECT id, school_id, name, code FROM departments ORDER BY name',
    );

    const departmentsBySchool = new Map<number, DepartmentRow[]>();
    for (const department of departments) {
      const list = departmentsBySchool.get(department.school_id) ?? [];
      list.push(department);
      departmentsBySchool.set(department.school_id, list);
    }

    res.json({
      schools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        slug: school.slug,
        departments: (departmentsBySchool.get(school.id) ?? []).map((department) => ({
          id: department.id,
          name: department.name,
          code: department.code,
        })),
      })),
      levels: LEVELS,
      noteTypes: NOTE_TYPES,
      announcementCategories: ANNOUNCEMENT_CATEGORIES,
    });
  }),
);

/** GET /api/taxonomy/courses?departmentId=1&level=300&q=csc */
taxonomyRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    const departmentId = Number(req.query.departmentId);
    if (Number.isInteger(departmentId) && departmentId > 0) {
      conditions.push('c.department_id = ?');
      params.push(departmentId);
    }

    const level = typeof req.query.level === 'string' ? req.query.level : '';
    if (level) {
      conditions.push('c.level = ?');
      params.push(level);
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      conditions.push('(c.code LIKE ? OR c.title LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query<
      Array<RowDataPacket & { id: number; code: string; title: string; level: string; department_id: number }>
    >(`SELECT c.id, c.code, c.title, c.level, c.department_id FROM courses c ${where} ORDER BY c.code LIMIT 300`, params);

    res.json({
      courses: rows.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        level: course.level,
        departmentId: course.department_id,
      })),
    });
  }),
);
