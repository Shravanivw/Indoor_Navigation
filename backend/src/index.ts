// src/index.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { buildGraphCache } from './services/routingService';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

async function main() {
  // Test DB connection
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  // Pre-build navigation graph into memory
  await buildGraphCache(prisma);

  const app = createApp(prisma);

  app.listen(PORT, () => {
    console.log(`[Server] Indoor Nav API running on http://localhost:${PORT}/api/v1`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

main().catch(e => {
  console.error('[Fatal]', e);
  process.exit(1);
});
