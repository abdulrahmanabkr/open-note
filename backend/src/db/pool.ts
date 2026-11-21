import mysql from 'mysql2/promise';
import { config } from '../config';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  dateStrings: false,
});

export async function assertDatabaseConnection(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
    // eslint-disable-next-line no-console
    console.log(`[db] connected to ${config.db.database} @ ${config.db.host}:${config.db.port}`);
  } finally {
    connection.release();
  }
}
