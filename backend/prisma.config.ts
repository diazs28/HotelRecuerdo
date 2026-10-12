import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Prisma CLI (migrate, db seed) usa el rol de migraciones si MIGRATION_DATABASE_URL está definida;
  // si no, DATABASE_URL. La API usa siempre DATABASE_URL (src/lib/prisma.ts).
  datasource: {
    url: process.env.MIGRATION_DATABASE_URL?.trim() || env('DATABASE_URL'),
  },
});
