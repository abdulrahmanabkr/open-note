import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import { config } from '../config';
import { seed } from './seed';

/**
 * Creates the database (if needed), applies schema.sql, then seeds demo data.
 * Run from the backend folder: `npm run db:init`
 */
async function main(): Promise<void> {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Hosted MySQL users often cannot create databases, but the database is
    // usually provisioned already. Continue and let USE surface a real error.
    if (code !== 'ER_DBACCESS_DENIED_ERROR' && code !== 'ER_ACCESS_DENIED_ERROR') throw error;
    console.warn(`[db] cannot create database (${code}); trying the existing one`);
  }
  await connection.query(`USE \`${config.db.database}\``);
  console.log(`[db] using database \`${config.db.database}\``);

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('[db] schema applied');
  } finally {
    await connection.end();
  }

  await seed();
}

main()
  .then(async () => {
    const { pool } = await import('./pool');
    await pool.end();
    console.log('[db] done — you can start the API now.');
  })
  .catch(async (error) => {
    console.error('[db] initialisation failed:', error);
    process.exitCode = 1;
    try {
      const { pool } = await import('./pool');
      await pool.end();
    } catch {
      /* ignore */
    }
  });
