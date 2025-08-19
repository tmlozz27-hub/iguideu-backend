// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

// ⚠️ MODELOS Y MIDDLEWARE (asegurate de tener estos archivos):
//   - ./models/Usuario.js
//   - ./models/GuideProfile.js
//   - ./middleware/auth.js
const Usuario = require('./models/Usuario');
const GuideProfile = require('./models/GuideProfile');
const auth = require('./middleware/auth');

const app = express();

// ---------- Config básica ----------
app.set('trust proxy', 1);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '256kb' }));

function mongoStateLabel(state) {
  return ["disconnected","connected","connecting","disconnecting"][state] ?? "unknown";
}

// ---------- HEALTH ----------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

// ---------- CONEXIÓN MONGO ----------
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

// ---------- HELPERS ----------
const JWT_SECRET = process.env.JWT_SECRET || 'changeme-super-secret';
function signToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// Valida formato ObjectId
const isId = (s) => mongoose.Types.ObjectId.isValid(s);

// Wrapper de async para errores
const a = (fn) => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

// ---------- AUTH ----------
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().max(120).required(),
  password: Joi.string().min(8).max(128).required(),
});

app.post('/api/auth/register', a(async (req, res) => {
  const { value, error } = registerSchema.validate(req.body);
  if (error) return res.status(400).json({ ok:false, error: error.message });

  const exists = await Usuario.findOne({ email: value.email.toLowerCase() });
  if (exists) return res.status(409).json({ ok:false, error: 'email ya registrado' });

  const passwordHash = await bcrypt.hash(value.password, 10);
  const user = await Usuario.create({ nombre: value.nombre, email: value.email.toLowerCase(), passwordHash });
  const token = signToken(user);
  res.status(201).json({
    ok: true,
    token,
    user: { id: user._id, nombre: user.nombre, email: user.email }
  });
}));

const loginSchema = Joi.object({
  email: Joi.string().email().max(120).required(),
  password: Joi.string().min(8).max(128).required(),
});

app.post('/api/auth/login', a(async (req, res) => {
  const { value, error } = loginSchema.validate(req.body);
  if (error) return res.status(400).json({ ok:false, error: error.message });

  const user = await Usuario.findOne({ email: value.email.toLowerCase() });
  if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error: 'credenciales inválidas' });

  const ok = await bcrypt.compare(value.password, user.passwordHash);
  if (!ok) return res.status(401).json({ ok:false, error: 'credenciales inválidas' });

  const token = signToken(user);
  res.json({
    ok: true,
    token,
    user: { id: user._id, nombre: user.nombre, email: user.email }
  });
}));

app.get('/api/me', auth, a(async (req, res) => {
  const user = await Usuario.findById(req.user.id).select('_id nombre email createdAt updatedAt');
  if (!user) return res.status(404).json({ ok:false, error:'usuario no encontrado' });
  res.json({ ok:true, user });
}));

// ---------- GUIDES (perfil del guía) ----------
const guidePutSchema = Joi.object({
  bio: Joi.string().min(10).max(1200).allow(''),
  pricePerHour: Joi.number().min(0).max(10000),
  languages: Joi.array().items(Joi.string().trim().min(2).max(40)).max(8),
  city: Joi.string().trim().min(2).max(80).allow(''),
  country: Joi.string().trim().min(2).max(80).allow(''),
  available: Joi.boolean(),
  photoUrl: Joi.string().uri().max(500).allow(''),
});

app.get('/api/guides/me', auth, a(async (req, res) => {
  let g = await GuideProfile.findOne({ user: req.user.id });
  if (!g) {
    // crea perfil en blanco si no existe (disponible=false por defecto)
    g = await GuideProfile.create({ user: req.user.id, available: false });
  }
  // populate básico del usuario para mostrar nombre/email
  await g.populate({ path:'user', select:'nombre email' });
  res.json({ ok:true, guide: g });
}));

app.put('/api/guides/me', auth, a(async (req, res) => {
  const { value, error } = guidePutSchema.validate(req.body, { stripUnknown: true });
  if (error) return res.status(400).json({ ok:false, error: error.message });

  const update = { ...value };
  let g = await GuideProfile.findOneAndUpdate(
    { user: req.user.id },
    { $set: update, $setOnInsert: { user: req.user.id } },
    { new: true, upsert: true }
  );
  await g.populate({ path:'user', select:'nombre email' });
  res.json({ ok:true, guide: g });
}));

// ---------- BOOKINGS ----------
const bookingSchema = Joi.object({
  guideId: Joi.string().required(),
  date: Joi.string().isoDate().required(),
  hours: Joi.number().integer().min(1).max(12).required(),
});

// Esquema Booking en runtime (sin archivo extra) para mantener dependencia mínima
const bookingSchemaMongo = new mongoose.Schema({
  guide: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  date: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  hours: { type: Number, required: true },
  status: { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending', index: true },
}, { timestamps: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchemaMongo);

// Comprueba solapamiento: (startA < endB) && (endA > startB)
async function hasOverlap(guideId, start, end) {
  const clash = await Booking.findOne({
    guide: guideId,
    status: { $ne: 'cancelled' },
    $or: [
      { date: { $lt: end }, endDate: { $gt: start } },
    ]
  }).select('_id');
  return !!clash;
}

// Crea reserva (viajero)
app.post('/api/bookings', auth, a(async (req, res) => {
  const { value, error } = bookingSchema.validate(req.body);
  if (error) return res.status(400).json({ ok:false, error: error.message });

  if (!isId(value.guideId)) return res.status(400).json({ ok:false, error:'guideId inválido' });

  const guide = await Usuario.findById(value.guideId);
  if (!guide) return res.status(404).json({ ok:false, error:'guía no encontrado' });

  const start = new Date(value.date);
  if (isNaN(start.getTime())) return res.status(400).json({ ok:false, error:'date inválida' });
  const end = new Date(start.getTime() + value.hours * 60 * 60 * 1000);

  // Política: no reservar en el pasado
  if (start.getTime() <= Date.now()) {
    return res.status(400).json({ ok:false, error:'no se puede reservar en el pasado' });
  }

  // Evita solapamientos para el guía
  const overlap = await hasOverlap(guide._id, start, end);
  if (overlap) return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });

  const booking = await Booking.create({
    guide: guide._id,
    traveler: req.user.id,
    date: start,
    endDate: end,
    hours: value.hours,
    status: 'pending',
  });

  const populated = await Booking.findById(booking._id)
    .populate({ path:'guide', select:'nombre email' })
    .populate({ path:'traveler', select:'nombre email' });

  res.status(201).json({ ok:true, booking: populated });
}));

// Lista reservas del usuario (como viajero o como guía)
app.get('/api/bookings', auth, a(async (req, res) => {
  const userId = req.user.id;
  const bookings = await Booking.find({
    $or: [{ traveler: userId }, { guide: userId }],
  })
  .sort({ date: 1 })
  .populate({ path:'guide', select:'nombre email' })
  .populate({ path:'traveler', select:'nombre email' });

  res.json({ ok:true, bookings });
}));

// Detalle
app.get('/api/bookings/:id', auth, a(async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ ok:false, error:'id inválido' });
  const b = await Booking.findById(id)
    .populate({ path:'guide', select:'nombre email' })
    .populate({ path:'traveler', select:'nombre email' });
  if (!b) return res.status(404).json({ ok:false, error:'reserva no encontrada' });

  // Sólo partes
  if (b.traveler.toString() !== req.user.id && b.guide.toString() !== req.user.id) {
    return res.status(403).json({ ok:false, error:'sin permiso' });
  }

  res.json({ ok:true, booking: b });
}));

// Cambiar estado con política:
//  - Guía (propietario) puede: 'confirmed' o 'cancelled' en cualquier momento.
//  - Viajero puede: 'cancelled' si faltan ≥ 24h (y si es su reserva).
const patchSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled').required(),
});

app.patch('/api/bookings/:id', auth, a(async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ ok:false, error:'id inválido' });

  const { value, error } = patchSchema.validate(req.body);
  if (error) return res.status(400).json({ ok:false, error: error.message });

  const b = await Booking.findById(id);
  if (!b) return res.status(404).json({ ok:false, error:'reserva no encontrada' });

  const isGuide = b.guide.toString() === req.user.id;
  const isTraveler = b.traveler.toString() === req.user.id;

  if (!isGuide && !isTraveler) {
    return res.status(403).json({ ok:false, error:'sin permiso' });
  }

  // Ya cancelada: no se puede mover de vuelta
  if (b.status === 'cancelled') {
    return res.status(400).json({ ok:false, error:'la reserva ya está cancelada' });
  }

  if (value.status === 'confirmed') {
    // Sólo guía puede confirmar
    if (!isGuide) return res.status(403).json({ ok:false, error:'sólo el guía puede confirmar' });
  }

  if (value.status === 'cancelled') {
    if (isGuide) {
      // Guía puede cancelar siempre
    } else if (isTraveler) {
      // Viajero: sólo si faltan ≥24h
      const hoursLeft = (b.date.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft < 24) {
        return res.status(403).json({ ok:false, error:'el viajero sólo puede cancelar con ≥24h de anticipación' });
      }
    }
  }

  b.status = value.status;
  await b.save();

  const populated = await Booking.findById(b._id)
    .populate({ path:'guide', select:'nombre email' })
    .populate({ path:'traveler', select:'nombre email' });

  res.json({ ok:true, booking: populated });
}));

// ---------- RUTA DE PRUEBA DB ----------
app.get('/api/dbtest', a(async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(500).json({ ok:false, error:'No conectado a MongoDB' });
  }
  const col = mongoose.connection.db.collection('__ping');
  const doc = { at: new Date() };
  await col.insertOne(doc);
  const count = await col.countDocuments();
  res.json({ ok:true, insertedAt: doc.at, totalDocs: count });
}));

// ---------- HOME ----------
app.get('/', (_req, res) => {
  res.send('I GUIDE U backend funcionando');
});

// ---------- ERROR HANDLER ----------
app.use((err, _req, res, _next) => {
  console.error('❗ Handler error:', err);
  if (res.headersSent) return;
  res.status(500).json({ ok:false, error: 'Error interno del servidor' });
});

// ---------- ARRANQUE ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
