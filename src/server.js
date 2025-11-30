// src/server.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Stripe from 'stripe';

import Guide from './models/Guide.js';

dotenv.config();

// ============================
// Config básica
// ============================
const app = express();

// Render / proxies → necesario para que express-rate-limit y X-Forwarded-For funcionen bien
app.set('trust proxy', 1);

const ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 4026;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;

const MONGODB_URI = process.env.MONGODB_URI;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// flags para /api/health
let dbOk = false;
let stripeKeyLoaded = Boolean(STRIPE_SECRET_KEY);

// ============================
// Middlewares globales
// ============================
app.use(morgan('combined'));

// 🌎 CORS ABIERTO (para que cualquier frontend, incluido el simple, funcione)
app.use(
  cors({
    origin: true, // refleja cualquier origin que llegue
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Rate limit general para /api
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200, // 200 requests por IP/ventana
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    return res.status(429).json({
      ok: false,
      error: 'Too many requests, please try again later.',
    });
  },
});

app.use('/api', apiLimiter);

// ⚠️ Stripe webhook: raw body ANTES de express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    console.log('🔔 Webhook Stripe recibido (stub).');
    return res.sendStatus(200);
  },
);

// Body parsers JSON / form → después del webhook
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================
// Rutas API
// ============================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    env: ENV,
    port: String(PORT),
    publicBaseUrl: PUBLIC_BASE_URL,
    db: dbOk,
    stripeKeyLoaded,
  });
});

// GET /api/guides → devuelve todos los guías
app.get('/api/guides', async (req, res) => {
  try {
    const guides = await Guide.find().lean();
    return res.json(guides);
  } catch (err) {
    console.error('❌ Error al obtener guías:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error al obtener guías',
    });
  }
});

// POST /api/payments/create-checkout → Checkout de prueba USD 10
app.post('/api/payments/create-checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        ok: false,
        error: 'Stripe no está configurado en el servidor',
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 10 * 100, // USD 10
            product_data: {
              name: 'I GUIDE U – Test checkout USD 10',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_BASE_URL}/stripe-success.html`,
      cancel_url: `${PUBLIC_BASE_URL}/stripe-cancel.html`,
    });

    return res.json({
      ok: true,
      url: session.url,
    });
  } catch (err) {
    console.error('❌ Error creando Checkout Stripe:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error creando Checkout en Stripe',
    });
  }
});

// 404 genérico
app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: 'Not found',
  });
});

// ============================
// Conexión a MongoDB + start server
// ============================
async function start() {
  try {
    if (!MONGODB_URI) {
      console.warn('⚠️ No hay MONGODB_URI');
    } else {
      try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB OK');
        dbOk = true;
      } catch (err) {
        console.error('❌ Error MongoDB:', err);
        dbOk = false;
        // el server igual arranca, pero health va a decir db:false
      }
    }

    app.listen(PORT, () => {
      console.log(`🚀 Backend iguideu24 corriendo en http://0.0.0.0:${PORT}`);
      console.log(`🌍 PublicBaseUrl: ${PUBLIC_BASE_URL}`);
      console.log(`🔐 Stripe key loaded: ${stripeKeyLoaded}`);
    });
  } catch (err) {
    console.error('❌ Error crítico al iniciar el servidor:', err);
    process.exit(1);
  }
}

start();
