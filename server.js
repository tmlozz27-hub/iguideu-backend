// server.js
require('dotenv').config();

const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const auth = require('./middleware/auth');               // ya lo tenés
const Usuario = require('./models/Usuario');             // ya lo tenés
const GuideProfile = require('./models/GuideProfile');   // ya lo tenés (si no, dejalo sin usar de momento)

const app = express();

/* =========================
   Seguridad & Middlewares
========================= */
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS estricto por lista en env (ALLOWED_ORIGINS="https://tuapp.com,https://otra.com")
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/PowerShell
    if (allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Origen no permitido por CORS'));
  },
  credentials: false,
}));

app.use(express.json({ limit: '512kb' }));

// Rate limits
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50, standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 60*1000,    max: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

/* =========================
   Utils / Validaciones
========================= */
const isObjectId = (s) => mongoose.Types.ObjectId.isValid(String(s));
const mongoStateLabel = (state) =>
  (["disconnected","connected","connecting","disconnecting"][state] ?? "unknown");

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

/* =========================
   Mongo & Modelos
========================= */
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri).then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

// Booking schema (ligero; si prefieres, luego lo separamos a models/Booking.js)
const bookingSchema = new mongoose.Schema({
  guide:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traveler:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  date:      { type: Date, required: true, index: true },           // inicio
  endDate:   { type: Date, required: true, index: true },           // fin (derivado de hours)
  hours:     { type: Number, required: true, min: 1, max: 12 },
  status:    { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending', index: true },
}, { timestamps: true });

// índices útiles
bookingSchema.index({ guide:1, date:1 });
bookingSchema.index({ traveler:1, date:1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

/* =========================
   Rutas básicas
========================= */
app.get('/', (_req, res) => {
  res.send('I GUIDE U backend funcionando');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

/* =========================
   Auth (register / login / me)
========================= */
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { nombre, email, password } = req.body || {};
    if (!nombre || String(nombre).trim().length < 2) {
      return res.status(400).json({ ok:false, error:'nombre requerido (min 2)' });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ ok:false, error:'email inválido' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ ok:false, error:'password mínimo 8 caracteres' });
    }

    const existing = await Usuario.findOne({ email: String(email).toLowerCase() });
    if (existing) return res.status(409).json({ ok:false, error:'email ya registrado' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await Usuario.create({
      nombre: String(nombre).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
    });

    const token = signToken({ id: user._id.toString(), email: user.email });
    res.status(201).json({
      ok: true,
      token,
      user: { id: user._id, nombre: user.nombre, email: user.email }
    });
  } catch (e) { next(e); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok:false, error:'email y password requeridos' });

    const user = await Usuario.findOne({ email: String(email).toLowerCase() });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = signToken({ id: user._id.toString(), email: user.email });
    res.json({ ok:true, token });
  } catch (e) { next(e); }
});

app.get('/api/me', auth, async (req, res, next) => {
  try {
    const me = await Usuario.findById(req.user.id).lean();
    if (!me) return res.status(404).json({ ok:false, error:'usuario no encontrado' });
    res.json({ ok:true, user: { _id: me._id, nombre: me.nombre, email: me.email, createdAt: me.createdAt, updatedAt: me.updatedAt } });
  } catch (e) { next(e); }
});

/* =========================
   Bookings
   Política:
   - Crear: traveler (cualquiera autenticado) crea contra un guideId (otro usuario).
   - Confirmar: sólo el guía dueño de la reserva -> status 'confirmed'.
   - Cancelar:
       * Guía: puede cancelar si aún no comenzó.
       * Viajero: puede cancelar sólo si faltan >= 24h para comenzar.
========================= */

// Crear booking
app.post('/api/bookings', auth, async (req, res, next) => {
  try {
    const travelerId = req.user.id;
    const { guideId, date, hours } = req.body || {};

    if (!isObjectId(guideId)) return res.status(400).json({ ok:false, error:'guideId inválido' });
    if (!hours || !Number.isInteger(hours) || hours < 1 || hours > 12)
      return res.status(400).json({ ok:false, error:'hours debe ser entero 1..12' });

    const start = new Date(date);
    if (isNaN(start.getTime())) return res.status(400).json({ ok:false, error:'date inválida' });

    const now = new Date();
    if (start.getTime() <= now.getTime() + 15*60*1000) {
      return res.status(400).json({ ok:false, error:'la reserva debe ser al menos 15 minutos en el futuro' });
    }

    // evitar self-booking
    if (travelerId === String(guideId)) {
      return res.status(400).json({ ok:false, error:'no podés reservarte a vos mismo' });
    }

    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

    // Chequear solapamientos del guía (pending/confirmed)
    const overlap = await Booking.findOne({
      guide: guideId,
      status: { $in: ['pending','confirmed'] },
      $or: [
        { date: { $lt: end }, endDate: { $gt: start } }, // rango se cruza
      ],
    }).lean();

    if (overlap) return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideId,
      traveler: travelerId,
      date: start,
      endDate: end,
      hours,
      status: 'pending',
    });

    const populated = await Booking.findById(booking._id)
      .populate('guide',     'nombre email')
      .populate('traveler',  'nombre email')
      .lean();

    res.status(201).json({ ok:true, booking: populated });
  } catch (e) { next(e); }
});

// Listar mis bookings (si soy guía, las mías como guía; si soy viajero, las mías como viajero)
app.get('/api/bookings', auth, async (req, res, next) => {
  try {
    const me = await Usuario.findById(req.user.id).lean();
    if (!me) return res.status(404).json({ ok:false, error:'usuario no encontrado' });

    // Heurística: si tengo bookings como guía, muestro esas; sino, como viajero.
    const asGuideCount = await Booking.countDocuments({ guide: me._id });
    const filter = asGuideCount > 0 ? { guide: me._id } : { traveler: me._id };

    const bookings = await Booking.find(filter)
      .sort({ date: 1 })
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    res.json({ ok:true, bookings });
  } catch (e) { next(e); }
});

// Detalle booking por ID (solo guía o viajero involucrados)
app.get('/api/bookings/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });

    const b = await Booking.findById(id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    if (!b) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    const uid = String(req.user.id);
    if (String(b.guide?._id) !== uid && String(b.traveler?._id) !== uid) {
      return res.status(403).json({ ok:false, error:'no autorizado' });
    }

    res.json({ ok:true, booking: b });
  } catch (e) { next(e); }
});

// Actualizar estado (confirm/cancel) según política
app.patch('/api/bookings/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!isObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });
    if (!['confirmed','cancelled'].includes(status)) {
      return res.status(400).json({ ok:false, error:"status debe ser 'confirmed' o 'cancelled'" });
    }

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    const uid = String(req.user.id);
    const isGuide    = String(booking.guide)    === uid;
    const isTraveler = String(booking.traveler) === uid;

    // No modificar si ya pasó el inicio
    const now = new Date();
    if (booking.date <= now) {
      return res.status(400).json({ ok:false, error:'la reserva ya comenzó o finalizó' });
    }

    // Reglas
    if (status === 'confirmed') {
      // Sólo el guía confirma
      if (!isGuide) return res.status(403).json({ ok:false, error:'sólo el guía puede confirmar' });
    }

    if (status === 'cancelled') {
      if (isGuide) {
        // El guía puede cancelar antes del inicio
        // (ya chequeado arriba que no empezó)
      } else if (isTraveler) {
        // Viajero: sólo si faltan >= 24h
        const hoursLeft = (booking.date - now) / (1000*60*60);
        if (hoursLeft < 24) {
          return res.status(403).json({ ok:false, error:'el viajero sólo puede cancelar con ≥24h de anticipación' });
        }
      } else {
        return res.status(403).json({ ok:false, error:'no autorizado' });
      }
    }

    booking.status = status;
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    res.json({ ok:true, booking: populated });
  } catch (e) { next(e); }
});

/* =========================
   /api/dbtest (sanity check)
========================= */
app.get('/api/dbtest', async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ ok:false, error: "No conectado a MongoDB" });
    }
    const col = mongoose.connection.db.collection("__ping");
    const doc = { at: new Date() };
    await col.insertOne(doc);
    const count = await col.countDocuments();
    res.json({ ok:true, insertedAt: doc.at, totalDocs: count });
  } catch (e) { next(e); }
});

/* =========================
   Handler de errores global
========================= */
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  const payload = { ok:false, error: err.message || 'internal_error' };
  if (process.env.NODE_ENV !== 'production' && err.stack) payload.stack = err.stack;
  res.status(status).json(payload);
});

/* =========================
   Arranque servidor
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

