// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import Guide from './models/Guide.js';

dotenv.config();

const app = express();

// Render / proxy
app.set('trust proxy', 1);

const ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 4026;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const MONGODB_URI = process.env.MONGODB_URI;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

let dbOk = false;
let stripeKeyLoaded = Boolean(STRIPE_SECRET_KEY);

// ============================
// MIDDLEWARES
// ============================

// CORS totalmente abierto
app.use(
  cors({
    origin: true, // refleja cualquier origin (localhost, file://, etc.)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ⚠️ Responder SIEMPRE 200 a cualquier OPTIONS (preflight)
app.options('*', (req, res) => {
  res.sendStatus(200);
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================
// RUTAS
// ============================

// Health
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

// Guides
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

// Stripe test checkout
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
            unit_amount: 10 * 100,
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
  res.status(404).json({
    ok: false,
    error: 'Not found',
  });
});

// ============================
// START
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

