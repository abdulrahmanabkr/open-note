import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool';
import { ApiError } from '../lib/http';
import { verifyToken, type Role } from '../lib/jwt';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Resolves the JWT to a fresh DB user (so role changes take effect immediately). */
async function resolveUser(req: Request): Promise<AuthUser | null> {
  const token = readBearerToken(req);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const [rows] = await pool.execute<Array<RowDataPacket & { id: number; full_name: string; email: string; role: Role }>>(
    'SELECT id, full_name, email, role FROM users WHERE id = ? LIMIT 1',
    [payload.sub],
  );

  const row = rows[0];
  if (!row) return null;
  return { id: row.id, fullName: row.full_name, email: row.email, role: row.role };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await resolveUser(req);
    if (!user) {
      next(new ApiError(401, 'Please sign in to continue.'));
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await resolveUser(req);
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'Please sign in to continue.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'You do not have permission to do that.'));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole('admin', 'superadmin');
