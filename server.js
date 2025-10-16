// server.js (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

const app = express();

// ---- Config
const PORT = Number(process.env.PORT || 4020);
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'iguideu_admin_2025';

// CORS (lista separada por comas)
const rawOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman
    if (rawOrigins.length === 0 || rawOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ---- Health
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGO_URI,
    payments: process.env.PAYMENTS_PROVIDER || 'none',
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    port: PORT,
  });
});

// ---- Admin
app.get('/api/admin/ping', (req, res) => {
  const headerKey = req.get('x-admin-key');
  if (headerKey !== ADMIN_API_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  res.json({ ok: true, pong: true });
});

// ---- Mongo (no bloquear arranque si falla)
(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('⚠️  MONGO_URI no definido; sigo sin DB.');
  } else {
    try {
      await mongoose.connect(uri, { dbName: process.env.MONGO_DB || 'iguideu10' });
      console.log('✅ MongoDB conectado');
    } catch (err) {
      console.error('❌ Error MongoDB:', err?.message || err);
      console.warn('⚠️  Continuo sin DB para no bloquear el server.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Express ON http://127.0.0.1:${PORT} PID=${process.pid}`);
  });
})();

// ---- Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err?.message || err);
  res.status(500).json({ ok: false, error: 'internal_error' });
});
