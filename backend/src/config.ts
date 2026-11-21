import 'dotenv/config';
import path from 'node:path';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const jwtSecret = process.env.JWT_SECRET ?? 'opennote-dev-secret-change-me';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  // Fail loudly rather than shipping a predictable secret.
  throw new Error('JWT_SECRET must be set in production.');
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwt: {
    secret: jwtSecret,
    expiresIn: '7d' as const,
  },
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER ?? 'opennote',
    password: process.env.DB_PASSWORD ?? 'opennote',
    database: process.env.DB_NAME ?? 'opennote',
  },
  uploadsDir: path.resolve(process.cwd(), 'uploads'),
  maxImagesPerNote: 5000,
  maxImageBytes: 8 * 1024 * 1024,
  maxDocumentBytes: 50 * 1024 * 1024,
};
