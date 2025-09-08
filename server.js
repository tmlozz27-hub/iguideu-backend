import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

import authRouter from './src/routes/auth.routes.js';
import bookingsRouter from './src/routes/bookings.routes.js';
import paymentsRouter from './src/routes/payments.routes.js';
import guidesRouter from './src/routes/guides.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// --- Seguridad base ---
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // desactivar CSP por ahora (evita ruido en dev)
}));

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
  origin: (origin, cb) => cb(null, allowedOrigin === '*' ? true : origin === allowedOrigin),
  credentials: true,
}));

app.use(express.json({ limit: '256kb' }));

// --- Rate limit global ---
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  max: Number(process.env.RATE_LIMIT_MAX || 100),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --- Rutas ---
app.use('/api/auth', authRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/guides', guidesRouter);

// --- Health ---
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

// --- 404 genérico ---
app.use((req, res) => {
  return res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  return res.status(500).json({ error: 'server_error' });
});

async function start() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI no definida (.env)');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[OK] MongoDB conectado');

    app.listen(PORT, '127.0.0.1', () => {
      console.log('[OK] Servidor Express en 127.0.0.1:3000');
    });
  } catch (err) {
    console.error('[ERR] MongoDB', err);
    process.exit(1);
  }
}

start();
