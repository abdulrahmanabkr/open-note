import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { assertDatabaseConnection } from './db/pool';
import { errorHandler } from './lib/http';
import { requireAuth } from './middleware/auth';
import { adminRouter } from './routes/admin';
import { announcementsRouter } from './routes/announcements';
import { authRouter } from './routes/auth';
import { notesRouter } from './routes/notes';
import { statsRouter } from './routes/stats';
import { taxonomyRouter } from './routes/taxonomy';

export const app = express();

const allowedOrigins = config.clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: false,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

fs.mkdirSync(path.join(config.uploadsDir, 'notes'), { recursive: true });

app.use(
  '/uploads',
  express.static(config.uploadsDir, {
    maxAge: config.env === 'production' ? '7d' : 0,
    fallthrough: true,
    index: false,
  }),
);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'opennote-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
// Every content endpoint requires a signed-in user. `/api/taxonomy` stays public
// because the registration form needs the school/department lists before login.
app.use('/api/notes', requireAuth, notesRouter);
app.use('/api/announcements', requireAuth, announcementsRouter);
app.use('/api/taxonomy', taxonomyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/stats', requireAuth, statsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found.' });
});

app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await assertDatabaseConnection();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[db] could not connect:', (error as Error).message);
    // eslint-disable-next-line no-console
    console.error('[db] check backend/.env, then run `npm run db:init` in the backend folder.');
  }

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] OpenNote listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${signal} received — shutting down.`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  void start();
}
