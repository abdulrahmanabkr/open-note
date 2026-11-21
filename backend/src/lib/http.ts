import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps async express handlers so rejected promises reach the error middleware. */
export function asyncHandler(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function getPagination(query: Record<string, unknown>, defaultLimit = 12, maxLimit = 48): Pagination {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query.limit) || defaultLimit)));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginationMeta(total: number, { page, limit }: Pagination) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

export function isNumericId(value: unknown): boolean {
  return typeof value === 'string' && /^\d+$/.test(value);
}

export function toInt(value: unknown, fallback: number | null = null): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

/** Shared error handler: turns ApiError/ZodError/multer errors into JSON. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }

  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'form';
      if (!details[key]) details[key] = issue.message;
    }
    res.status(422).json({ message: 'Please check the highlighted fields.', details });
    return;
  }

  if (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'MulterError') {
    const multerErr = err as { code?: string };
    const message =
      multerErr.code === 'LIMIT_FILE_SIZE'
        ? `Images must be ${Math.round(config.maxImageBytes / (1024 * 1024))} MB or smaller, and PDFs ${Math.round(config.maxDocumentBytes / (1024 * 1024))} MB or smaller.`
        : multerErr.code === 'LIMIT_UNEXPECTED_FILE' || multerErr.code === 'LIMIT_FILE_COUNT'
          ? 'This note has reached the maximum number of images.'
          : 'Could not process the uploaded file.';
    res.status(400).json({ message });
    return;
  }

  if (typeof err === 'object' && err !== null) {
    const dbErr = err as { code?: string; errno?: number };
    if (dbErr.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'That record already exists.' });
      return;
    }
    if (dbErr.code === 'ECONNREFUSED') {
      res.status(503).json({ message: 'The database is unreachable. Please try again shortly.' });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[error]', err);
  res.status(500).json({ message: 'Something went wrong on our side.' });
}
