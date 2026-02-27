import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL || '';

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || '',
  },
  strict: true,
  verbose: true,
});
