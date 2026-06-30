// src/index.ts - Cache reload trigger
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { buildGraphCache } from './services/routingService';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

async function main() {
  // Test DB connection
  await prisma.$connect();
  console.log('[DB] Connected to database');

  // Pre-build navigation graph into memory
  await buildGraphCache(prisma);

  const app = createApp(prisma);

  app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? `0.0.0.0 (LAN accessible via your machine IP)` : HOST;
    console.log(`[Server] Indoor Nav API running on http://${displayHost}:${PORT}/api/v1`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV ?? 'development'}`);
  });
}

main().catch(e => {
  console.error('[Fatal]', e);
  process.exit(1);
});
