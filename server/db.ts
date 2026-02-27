import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export async function connectDB() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await pool.end();
  console.log('Database disconnected');
}

export { pool };
