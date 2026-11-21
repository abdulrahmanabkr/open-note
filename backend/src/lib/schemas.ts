import { z } from 'zod';

export const optionalId = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export const roleSchema = z.enum(['student', 'admin', 'superadmin']);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72),
  schoolId: optionalId,
  departmentId: optionalId,
  level: z.string().trim().max(10).optional(),
  matricNo: z.string().trim().max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  schoolId: z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z.coerce.number().int().positive().nullable().optional(),
  ),
  departmentId: z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z.coerce.number().int().positive().nullable().optional(),
  ),
  level: z.preprocess((v) => (v === '' || v === null ? null : v), z.string().trim().max(10).nullable().optional()),
  matricNo: z.preprocess((v) => (v === '' || v === null ? null : v), z.string().trim().max(40).nullable().optional()),
  bio: z.preprocess((v) => (v === '' || v === null ? null : v), z.string().trim().max(280).nullable().optional()),
});
