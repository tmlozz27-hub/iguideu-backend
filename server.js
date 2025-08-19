// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const auth = require('./middleware/auth');
const Usuario = require('./models/Usuario');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Mongo ----------
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}
const mongoStateLabel = (s) => (["disconnected","connected","connecting","disconnecting"][s] ?? "unknown");

// ---------- Health ----------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

// ---------- AUTH ----------
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).max(60).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const existing = await Usuario.findOne({ email: value.email });
    if (existing) return res.status(409).json({ ok:false, error:'email ya registrado' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({
      nombre: value.nombre,
      email: value.email,
      passwordHash,
    });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ ok:true, token, user: { id: user._id, nombre: user.nombre, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error registrando usuario' });
  }
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const user = await Usuario.findOne({ email: value.email });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok:true, token, user: { id: user._id, nombre: user.nombre, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error en login' });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ ok:false, error:'usuario no encontrado' });
    res.json({ ok:true, user: { _id: user._id, nombre: user.nombre, email: user.email, createdAt: user.createdAt, updatedAt: user.updatedAt } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error en /me' });
  }
});

// ---------- BOOKINGS ----------
const bookingSchema = new mongoose.Schema({
  guide:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  date:     { type: Date, required: true, index: true },       // inicio
  endDate:  { type: Date, required: true, index: true },       // fin calculado
  hours:    { type: Number, required: true, min: 1, max: 12 }, // duración
  status:   { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending', index: true },
}, { timestamps: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

const HOURS_MAX = 12;
const toDate = d => { const x = new Date(d); return isNaN(x.getTime()) ? null : x; };

// Crear booking
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { guideId, date, hours } = req.body;
    if (!guideId || !date || !hours) return res.status(400).json({ ok:false, error:'guideId, date y hours son requeridos' });

    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > HOURS_MAX) {
      return res.status(400).json({ ok:false, error:`hours debe ser un número entre 1 y ${HOURS_MAX}` });
    }

    const start = toDate(date);
    if (!start) return res.status(400).json({ ok:false, error:'date inválida' });
    const end = new Date(start.getTime() + h * 60 * 60 * 1000);

    const guide = await Usuario.findById(guideId);
    if (!guide) return res.status(404).json({ ok:false, error:'Guía no encontrado' });

    const overlap = await Booking.findOne({
      guide: guideId,
      status: { $in: ['pending','confirmed'] },
      date:   { $lt: end },
      endDate:{ $gt: start },
    }).lean();
    if (overlap) return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideId,
      traveler: req.user.id,
      date: start,
      endDate: end,
      hours: h,
      status: 'pending',
    });

    const populated = await Booking.findById(booking._id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    res.status(201).json({ ok:true, booking: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error creando booking' });
  }
});

// Listar bookings (como traveler por default; ?as=guide para ver los del guía)
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const as = (req.query.as || '').toString().toLowerCase();
    const filter = (as === 'guide') ? { guide: req.user.id } : { traveler: req.user.id };

    const bookings = await Booking.find(filter)
      .sort({ date: 1 })
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    res.json({ ok:true, bookings });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error listando bookings' });
  }
});

// Detalle
app.get('/api/bookings/:id', auth, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();
    if (!b) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    if (b.guide?._id?.toString() !== req.user.id && b.traveler?._id?.toString() !== req.user.id) {
      return res.status(403).json({ ok:false, error:'sin permiso para ver este booking' });
    }
    res.json({ ok:true, booking: b });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error obteniendo booking' });
  }
});

// Cambiar estado (sólo guía)
app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b) return res.status(404).json({ ok:false, error:'booking no encontrado' });
    if (b.guide.toString() !== req.user.id) {
      return res.status(403).json({ ok:false, error:'sólo el guía puede modificar el estado' });
    }

    const status = (req.body?.status || '').toString().toLowerCase();
    if (!['confirmed','cancelled'].includes(status)) {
      return res.status(400).json({ ok:false, error:"status debe ser 'confirmed' o 'cancelled'" });
    }

    b.status = status;
    await b.save();

    const populated = await Booking.findById(b._id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    res.json({ ok:true, booking: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'error actualizando booking' });
  }
});

// Raíz
app.get('/', (_req, res) => res.send('I GUIDE U backend funcionando'));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
