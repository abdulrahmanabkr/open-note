import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';
import { ApiError } from '../lib/http';

/** Formats every browser can display, stored exactly as uploaded. */
const PASSTHROUGH_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const MIME_BY_EXTENSION = new Map<string, string>([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff'],
  ['.bmp', 'image/bmp'],
  ['.pdf', 'application/pdf'],
]);

const EXTENSION_BY_MIME = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
  ['image/tiff', '.tiff'],
  ['image/bmp', '.bmp'],
  ['application/pdf', '.pdf'],
]);

const MIME_ALIASES = new Map<string, string>([
  ['image/tif', 'image/tiff'],
  ['image/x-tiff', 'image/tiff'],
  ['image/x-ms-bmp', 'image/bmp'],
  ['image/x-bmp', 'image/bmp'],
]);

const ACCEPTED_LABEL = 'JPG, PNG, WEBP, GIF, AVIF, TIFF, BMP or PDF';

interface FileInfo {
  originalname: string;
  mimetype: string;
}

function extensionOf(name: string): string {
  return path.extname(name).toLowerCase();
}

function resolveMime(info: FileInfo): string | null {
  const declared = MIME_ALIASES.get(info.mimetype.toLowerCase()) ?? info.mimetype.toLowerCase();
  if (EXTENSION_BY_MIME.has(declared)) return declared;
  return MIME_BY_EXTENSION.get(extensionOf(info.originalname)) ?? null;
}

function destinationFor(userId: number): string {
  const dir = path.join(config.uploadsDir, 'notes', String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.user?.id;
    if (!userId) {
      cb(new ApiError(401, 'Please sign in to upload notes.'), '');
      return;
    }
    try {
      cb(null, destinationFor(userId));
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const mime = resolveMime(file);
    const extension = (mime && EXTENSION_BY_MIME.get(mime)) || extensionOf(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    // PDFs need more room than a page image; the per-type limits are enforced in
    // `normalizeNoteUploads` once we know what each file actually is.
    fileSize: Math.max(config.maxImageBytes, config.maxDocumentBytes),
    files: config.maxImagesPerNote,
  },
  fileFilter: (_req, file, cb) => {
    if (!resolveMime(file)) {
      cb(new ApiError(400, `Unsupported file type. Upload ${ACCEPTED_LABEL} files.`));
      return;
    }
    cb(null, true);
  },
});

export const uploadNoteImages = upload.array('images', config.maxImagesPerNote);

type Mupdf = typeof import('mupdf');
// `mupdf` is an ESM-only module with top-level await, so it cannot be `require`d
// from this CommonJS build. This keeps the native dynamic import intact.
const importModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<Mupdf>;
let mupdfPromise: Promise<Mupdf> | null = null;

function loadMupdf(): Promise<Mupdf> {
  mupdfPromise ??= importModule('mupdf');
  return mupdfPromise;
}

function pageFileName(index: number): string {
  return `${Date.now()}-${crypto.randomUUID()}-p${index + 1}.png`;
}

function buildPageFile(
  destination: string,
  sourceName: string,
  pageIndex: number,
  totalPages: number,
  png: Buffer,
): Express.Multer.File {
  const filename = pageFileName(pageIndex);
  const absolute = path.join(destination, filename);
  fs.writeFileSync(absolute, png);

  const base = path.basename(sourceName, path.extname(sourceName)).slice(0, 180) || 'page';
  const pageLabel = totalPages === 1 ? '' : ` (page ${pageIndex + 1})`;

  // Multer-written files always have these fields; `buffer` is memory-storage only.
  return {
    fieldname: 'images',
    originalname: `${base}${pageLabel}.png`,
    encoding: '7bit',
    mimetype: 'image/png',
    size: png.length,
    destination,
    filename,
    path: absolute,
  } as Express.Multer.File;
}

/** Renders a PDF/TIFF/BMP file into one PNG per page. */
async function renderDocument(file: Express.Multer.File, mime: string, maxPages: number): Promise<Express.Multer.File[]> {
  const mupdf = await loadMupdf();
  const buffer = await fs.promises.readFile(file.path);

  let document: ReturnType<Mupdf['Document']['openDocument']>;
  try {
    document = mupdf.Document.openDocument(buffer, mime);
  } catch {
    throw new ApiError(422, `${file.originalname} could not be read as a ${mime === 'application/pdf' ? 'PDF' : 'image'}.`);
  }

  const pageCount = document.countPages();
  if (pageCount < 1) {
    document.destroy();
    throw new ApiError(422, `${file.originalname} has no pages to show.`);
  }
  if (pageCount > maxPages) {
    document.destroy();
    throw new ApiError(
      422,
      `${file.originalname} has ${pageCount} pages, but only ${maxPages} more page${maxPages === 1 ? '' : 's'} can be added to this note.`,
    );
  }

  const scale = mime === 'application/pdf' ? 2 : 1;
  const pages: Express.Multer.File[] = [];

  try {
    for (let index = 0; index < pageCount; index += 1) {
      const page = document.loadPage(index);
      const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
      const png = Buffer.from(pixmap.asPNG());
      pages.push(buildPageFile(file.destination, file.originalname, index, pageCount, png));
      pixmap.destroy();
      page.destroy();
    }
  } catch (error) {
    for (const page of pages) fs.promises.unlink(page.path).catch(() => undefined);
    throw error instanceof ApiError ? error : new ApiError(422, `${file.originalname} could not be converted.`);
  } finally {
    document.destroy();
  }

  return pages;
}

function uploadedFiles(req: Request): Express.Multer.File[] {
  return Array.isArray(req.files) ? req.files : [];
}

/**
 * Normalizes non-browser formats (PDF, TIFF, BMP) into PNG page images before
 * the route touches them, so the rest of the app only ever deals with images.
 */
export async function normalizeNoteUploads(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const uploaded = uploadedFiles(req);
  if (uploaded.length === 0) {
    next();
    return;
  }

  const kept: Express.Multer.File[] = [];
  const created: Express.Multer.File[] = [];
  const converted: Express.Multer.File[] = [];

  try {
    for (const file of uploaded) {
      const mime = resolveMime(file);
      if (!mime) {
        throw new ApiError(400, `Unsupported file type. Upload ${ACCEPTED_LABEL} files.`);
      }

      const limit = PASSTHROUGH_MIME.has(mime) ? config.maxImageBytes : config.maxDocumentBytes;
      if (file.size > limit) {
        throw new ApiError(
          422,
          `${file.originalname} is larger than ${Math.round(limit / (1024 * 1024))} MB.`,
        );
      }

      if (PASSTHROUGH_MIME.has(mime)) {
        kept.push(file);
        continue;
      }

      const remaining = config.maxImagesPerNote - kept.length;
      if (remaining <= 0) {
        throw new ApiError(422, 'This note already has the maximum number of pages.');
      }

      converted.push(file);
      const pages = await renderDocument(file, mime, remaining);
      created.push(...pages);
      kept.push(...pages);
    }

    req.files = kept;
    for (const file of converted) fs.promises.unlink(file.path).catch(() => undefined);
    next();
  } catch (error) {
    for (const file of uploaded) fs.promises.unlink(file.path).catch(() => undefined);
    for (const file of created) fs.promises.unlink(file.path).catch(() => undefined);
    next(error);
  }
}

/** Deletes a stored upload referenced by a relative `/uploads/...` path. */
export function deleteUpload(relativePath: string | null | undefined): void {
  if (!relativePath?.startsWith('/uploads/')) return;
  const absolute = path.join(config.uploadsDir, relativePath.replace('/uploads/', '').replace(/\.\./g, ''));
  fs.promises.unlink(absolute).catch(() => undefined);
}
