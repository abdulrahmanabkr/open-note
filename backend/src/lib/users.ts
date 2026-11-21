import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';
import type { Role } from './jwt';

export interface PublicUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  schoolId: number | null;
  schoolName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  level: string | null;
  matricNo: string | null;
  bio: string | null;
  createdAt: Date;
}

export interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  school_id: number | null;
  school_name: string | null;
  department_id: number | null;
  department_name: string | null;
  level: string | null;
  matric_no: string | null;
  bio: string | null;
  created_at: Date;
}

export const USER_SELECT = `
  SELECT u.id, u.full_name, u.email, u.role,
         u.school_id, s.name AS school_name,
         u.department_id, d.name AS department_name,
         u.level, u.matric_no, u.bio, u.created_at
  FROM users u
  LEFT JOIN schools s ON s.id = u.school_id
  LEFT JOIN departments d ON d.id = u.department_id
`;

export function mapUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    schoolId: row.school_id,
    schoolName: row.school_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    level: row.level,
    matricNo: row.matric_no,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

export async function findUserById(id: number): Promise<PublicUser | null> {
  const [rows] = await pool.execute<UserRow[]>(`${USER_SELECT} WHERE u.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserWithPassword(email: string) {
  const [rows] = await pool.execute<
    Array<UserRow & { password_hash: string; role: Role }>
  >(
    `SELECT u.id, u.full_name, u.email, u.password_hash, u.role,
            u.school_id, s.name AS school_name,
            u.department_id, d.name AS department_name,
            u.level, u.matric_no, u.bio, u.created_at
     FROM users u
     LEFT JOIN schools s ON s.id = u.school_id
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.email = ? LIMIT 1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}
