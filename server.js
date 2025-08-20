// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const app = express();

/* ===========================
   Seguridad y middlewares
=========================== */
app.set('trust proxy', 1); // para rate-limit detrás de proxy (Render)

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Ajusta origins si quieres restringir a tu dominio/app móvil
const ALLOWED_ORIGINS = [
  'https://iguideu-frontend.onrender.com',
  'https://studio.apollographql.com', // ejemplo
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // permite curl/Invoke-RestMethod
    if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return cb(null, true);
    return cb(null, true); // relaja por ahora; endurecer luego
  },
  credentials: false,
}));

app.use(express.json({ limit: '200kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/* ===========================
   Conexión Mongo
=========================== */
const mongoStateLabel = s => (["disconnected", "connected", "connecting", "disconnecting"][s] ?? "unknown");
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI && !/localhost|127\.0\.0\.1/.test(MONGODB_URI)) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

/* ===========================
   Modelos
=========================== */
const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, minlength: 2 },
  email:  { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  passwordHash: { type: String },
}, { timestamps: true });
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

const guideProfileSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', unique: true, index: true },
  bio:          { type: String, trim: true, default: '' },
  pricePerHour: { type: Number, min: 0, default: 0 },
  languages:    { type: [String], default: [] }, // almacena en minúsculas
  city:         { type: String, trim: true, default: '' },
  country:      { type: String, trim: true, default: '' },
  available:    { type: Boolean, default: true },
  ratingAvg:    { type: Number, min: 0, max: 5, default: 0 },
  ratingCount:  { type: Number, min: 0, default: 0 },
}, { timestamps: true });
const GuideProfile = mongoose.models.GuideProfile || mongoose.model('GuideProfile', guideProfileSchema);

const bookingSchema = new mongoose.Schema({
  guide:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traveler:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  date:      { type: Date, required: true },
  endDate:   { type: Date, required: true },
  hours:     { type: Number, min: 1, max: 12, required: true },
  status:    { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending', index: true },
}, { timestamps: true });
bookingSchema.index({ guide: 1, date: 1, endDate: 1 });
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

/* ===========================
   Helpers
=========================== */
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
function signToken(u) {
  return jwt.sign({ id: u._id, email: u.email }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok:false, error:'token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email }
    next();
  } catch {
    return res.status(401).json({ ok:false, error:'token inválido' });
  }
}
const isGuide = (booking, userId) => booking.guide?.toString() === userId.toString();
const isTraveler = (booking, userId) => booking.traveler?.toString() === userId.toString();
const HOURS_24 = 24 * 60 * 60 * 1000;

/* ===========================
   Rutas base / health
=========================== */
app.get('/', (_req, res) => res.send('I GUIDE U backend funcionando'));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

app.get('/api/dbtest', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ ok: false, error: "No conectado a MongoDB" });
    }
    const col = mongoose.connection.db.collection("__ping");
    const doc = { at: new Date() };
    await col.insertOne(doc);
    const count = await col.countDocuments();
    res.json({ ok: true, insertedAt: doc.at, totalDocs: count });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===========================
   Auth
=========================== */
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});
app.post('/api/auth/register', async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const exists = await Usuario.findOne({ email: value.email.toLowerCase() });
    if (exists) return res.status(409).json({ ok:false, error:'email ya registrado' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({ nombre: value.nombre, email: value.email, passwordHash });

    // crea profile si no existía
    await GuideProfile.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id } },
      { upsert: true, new: true }
    );

    const token = signToken(user);
    res.status(201).json({ ok:true, token });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const user = await Usuario.findOne({ email: value.email.toLowerCase() });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });
    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = signToken(user);
    res.json({ ok:true, token });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).select('_id nombre email createdAt updatedAt');
    if (!user) return res.status(404).json({ ok:false, error:'usuario no encontrado' });
    res.json({ ok:true, user });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/* ===========================
   Guides (me + públicos)
=========================== */
const guidePutSchema = Joi.object({
  bio: Joi.string().allow('').max(1000),
  pricePerHour: Joi.number().min(0).max(10000),
  languages: Joi.array().items(Joi.string()).max(20),
  city: Joi.string().allow('').max(120),
  country: Joi.string().allow('').max(120),
  available: Joi.boolean(),
});
app.get('/api/guides/me', auth, async (req, res) => {
  try {
    const guide = await GuideProfile.findOne({ user: req.user.id }).populate('user', 'nombre email');
    if (!guide) return res.status(404).json({ ok:false, error:'perfil de guía no encontrado' });
    res.json({ ok:true, guide });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});
app.put('/api/guides/me', auth, async (req, res) => {
  try {
    const { value, error } = guidePutSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    if (value.languages) value.languages = value.languages.map(s => String(s).toLowerCase());
    const updated = await GuideProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: value, $setOnInsert: { user: req.user.id } },
      { upsert: true, new: true }
    ).populate('user', 'nombre email');

    res.json({ ok:true, guide: updated });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Públicos: lista y detalle
app.get('/api/guides', async (req, res) => {
  try {
    const { city, country, language, maxPrice, available } = req.query;
    const q = {};
    if (city) q.city = new RegExp(`^${city}$`, 'i');
    if (country) q.country = new RegExp(`^${country}$`, 'i');
    if (typeof available !== 'undefined') {
      if (available === 'true') q.available = true;
      if (available === 'false') q.available = false;
    }
    if (language) q.languages = { $in: [String(language).toLowerCase()] };
    if (maxPrice) q.pricePerHour = { $lte: Number(maxPrice) };

    const guides = await GuideProfile
      .find(q)
      .populate('user', 'nombre email')
      .sort({ ratingAvg: -1, ratingCount: -1 });

    res.json({ ok:true, guides });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

app.get('/api/guides/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ ok:false, error:'userId inválido' });
    }
    const guide = await GuideProfile.findOne({ user: userId }).populate('user', 'nombre email');
    if (!guide) return res.status(404).json({ ok:false, error:'Guía no encontrado' });
    res.json({ ok:true, guide });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/* ===========================
   Bookings
=========================== */
const bookingCreateSchema = Joi.object({
  guideId: Joi.string().required(),
  date: Joi.date().iso().required(),
  hours: Joi.number().integer().min(1).max(12).required(),
});

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { value, error } = bookingCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    if (!mongoose.isValidObjectId(value.guideId)) {
      return res.status(400).json({ ok:false, error:'guideId inválido' });
    }
    const guideUser = await Usuario.findById(value.guideId);
    if (!guideUser) return res.status(404).json({ ok:false, error:'guía no encontrado' });

    const start = new Date(value.date);
    const end = new Date(start.getTime() + value.hours * 60 * 60 * 1000);

    // solape para el guía
    const overlap = await Booking.findOne({
      guide: value.guideId,
      status: { $ne: 'cancelled' },
      $or: [
        { date: { $lt: end }, endDate: { $gt: start } }, // rango que se pisa
      ]
    });
    if (overlap) return res.status(409).json({ ok:false, error: 'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideUser._id,
      traveler: req.user.id,
      date: start,
      endDate: end,
      hours: value.hours,
      status: 'pending',
    });

    await booking.populate([
      { path: 'guide', select: 'nombre email' },
      { path: 'traveler', select: 'nombre email' }
    ]);

    res.status(201).json({ ok:true, booking });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Listado del usuario autenticado (guía: sus reservas recibidas; viajero: sus reservas hechas)
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const bookings = await Booking.find({
      $or: [{ guide: userId }, { traveler: userId }]
    })
    .sort({ date: 1 })
    .populate('guide', 'nombre email')
    .populate('traveler', 'nombre email');

    res.json({ ok:true, bookings });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Detalle
app.get('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });

    const booking = await Booking.findById(id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email');
    if (!booking) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    // Solo guía o viajero pueden ver
    if (!isGuide(booking, req.user.id) && !isTraveler(booking, req.user.id)) {
      return res.status(403).json({ ok:false, error:'sin permiso para ver esta reserva' });
    }

    res.json({ ok:true, booking });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Cambiar estado (confirm/cancel) con política
const bookingStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled').required(),
});
app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });

    const { value, error } = bookingStatusSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    let booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    const now = Date.now();
    const msToStart = new Date(booking.date).getTime() - now;

    if (value.status === 'confirmed') {
      // Solo guía puede confirmar
      if (!isGuide(booking, req.user.id)) {
        return res.status(403).json({ ok:false, error:'sólo el guía puede confirmar' });
      }
      // No confirmar si ya cancelado
      if (booking.status === 'cancelled') {
        return res.status(400).json({ ok:false, error:'no se puede confirmar una reserva cancelada' });
      }
      booking.status = 'confirmed';
    }

    if (value.status === 'cancelled') {
      if (isGuide(booking, req.user.id)) {
        // el guía puede cancelar en cualquier momento (negocio: podría limitarse)
        booking.status = 'cancelled';
      } else if (isTraveler(booking, req.user.id)) {
        // viajero puede cancelar si faltan al menos 24h
        if (msToStart < HOURS_24) {
          return res.status(400).json({ ok:false, error:'viajero sólo puede cancelar con ≥24h de antelación' });
        }
        booking.status = 'cancelled';
      } else {
        return res.status(403).json({ ok:false, error:'no autorizado' });
      }
    }

    await booking.save();
    booking = await booking
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email');

    res.json({ ok:true, booking });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

/* ===========================
   Arranque server
=========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
