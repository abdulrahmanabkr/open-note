import jwt from 'jsonwebtoken';
import { config } from '../config';

export type Role = 'student' | 'admin' | 'superadmin';

export interface TokenPayload {
  sub: number;
  role: Role;
}

export function signToken(userId: number, role: Role): string {
  return jwt.sign({ sub: userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'number') return null;
    return { sub: decoded.sub, role: decoded.role as Role };
  } catch {
    return null;
  }
}
