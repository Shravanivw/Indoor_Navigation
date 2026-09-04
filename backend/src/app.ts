// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createRouter } from './api/routes';

export function createApp(prisma: PrismaClient) {
  const app = express();

  app.get('/hello', (_req, res) => {
    res.send('HELLO_FROM_APP_TS');
  });

  const allowedOrigins = (
    process.env.FRONTEND_URLS
    ?? `${process.env.FRONTEND_URL ?? ''},http://localhost:5173,http://localhost:5174`
  )
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  // ─── SECURITY & MIDDLEWARE ──────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
  }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  // Rate limiting — 200 req/min per IP
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' },
  }));

  // ─── ROUTES ─────────────────────────────────────────────────────────────────
  console.log("MOUNTING ROUTER");
  const apiRouter = createRouter(prisma);
  app.use('/api/v1', apiRouter);
  // Direct endpoint aliases for POST /layouts/publish and POST /api/layouts/publish
  app.post(['/layouts/publish', '/api/layouts/publish'], (req, res, next) => {
    req.url = '/layouts/publish';
    apiRouter(req, res, next);
  });
  console.log("ROUTER MOUNTED");

  // ─── 404 ────────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // ─── ERROR HANDLER ───────────────────────────────────────────────────────────
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[Error]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}
