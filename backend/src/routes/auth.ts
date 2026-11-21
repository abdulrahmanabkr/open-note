import bcrypt from 'bcryptjs';
import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';
import { ApiError, asyncHandler } from '../lib/http';
import { signToken } from '../lib/jwt';
import { loginSchema, registerSchema, updateProfileSchema } from '../lib/schemas';
import { findUserById, findUserWithPassword, mapUser } from '../lib/users';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

const SALT_ROUNDS = 10;

async function assertDepartmentBelongsToSchool(schoolId: number, departmentId: number): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM departments WHERE id = ? AND school_id = ? LIMIT 1',
    [departmentId, schoolId],
  );
  if (!rows[0]) {
    throw new ApiError(422, 'That department does not belong to the selected school.', {
      departmentId: 'Pick a department in the selected school.',
    });
  }
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [input.email],
    );
    if (existing[0]) {
      throw new ApiError(409, 'An account with this email already exists.', {
        email: 'This email is already registered.',
      });
    }

    if (input.schoolId && input.departmentId) {
      await assertDepartmentBelongsToSchool(input.schoolId, input.departmentId);
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (full_name, email, password_hash, role, school_id, department_id, level, matric_no)
       VALUES (?, ?, ?, 'student', ?, ?, ?, ?)`,
      [
        input.fullName,
        input.email,
        passwordHash,
        input.schoolId ?? null,
        input.departmentId ?? null,
        input.level || null,
        input.matricNo || null,
      ],
    );

    const user = await findUserById(result.insertId);
    if (!user) throw new ApiError(500, 'Could not create your account. Please try again.');

    res.status(201).json({ token: signToken(user.id, user.role), user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const row = await findUserWithPassword(input.email);

    // Compare against a dummy hash when the user is unknown so timing stays similar.
    const hash = row?.password_hash ?? '$2a$10$CwTycUXWue0Thq9StjUM0uJ8DrsdJvQ0mUuV/1/hGGK5Y5u.rT8vS';
    const valid = await bcrypt.compare(input.password, hash);

    if (!row || !valid) {
      throw new ApiError(401, 'Email or password is incorrect.');
    }

    const user = mapUser(row);
    res.json({ token: signToken(user.id, user.role), user });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.user!.id);
    if (!user) throw new ApiError(404, 'Account not found.');
    res.json({ user });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const current = await findUserById(req.user!.id);
    if (!current) throw new ApiError(404, 'Account not found.');

    const schoolId = input.schoolId === undefined ? current.schoolId : input.schoolId;
    const departmentId = input.departmentId === undefined ? current.departmentId : input.departmentId;

    if (schoolId && departmentId) {
      await assertDepartmentBelongsToSchool(schoolId, departmentId);
    }

    await pool.execute(
      `UPDATE users
         SET full_name = ?, school_id = ?, department_id = ?, level = ?, matric_no = ?, bio = ?
       WHERE id = ?`,
      [
        input.fullName ?? current.fullName,
        schoolId,
        departmentId,
        input.level === undefined ? current.level : input.level,
        input.matricNo === undefined ? current.matricNo : input.matricNo,
        input.bio === undefined ? current.bio : input.bio,
        current.id,
      ],
    );

    const user = await findUserById(current.id);
    res.json({ user });
  }),
);

/** Lightweight directory helper used by the admin users table. */
authRouter.get(
  '/lookup/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findUserById(Number(req.params.id));
    if (!user) throw new ApiError(404, 'User not found.');
    res.json({ user });
  }),
);
