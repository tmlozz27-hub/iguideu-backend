import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

/** Aplica middlewares de seguridad y límites */
export function applyHardening(app) {
  // CORS estricto: ajustá origins si lo necesitás
  const allowedOrigins = ['http://localhost:5173','http://127.0.0.1:5173'];
  app.use(cors({
    origin: function (origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
  }));

  // HTTP headers seguros
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Límite de rate para API (ajustable)
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,               // 300 reqs / 15min por IP
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Body parser con límites para evitar payloads gigantes
  app.use((await import('express')).default.json({ limit: '200kb' }));
  app.use((await import('express')).default.urlencoded({ extended: true, limit: '200kb' }));

  // Sanitización contra operadores de Mongo inyectados
  app.use(mongoSanitize());

  // Respuestas JSON consistentes para errores comunes
  app.use((req, res, next) => {
    res.fail = (code, msg, extra = {}) => res.status(code).json({ error: msg, ...extra });
    next();
  });
}
