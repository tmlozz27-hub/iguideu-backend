// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const auth = require('./middleware/auth');
const Usuario = require('./models/Usuario'); // ya lo tenés
// (GuideProfile existe pero no es necesario para estas rutas)

// ---------- App & middlewares ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- Utils ----------
const mongoStateLabel = (s) => (["disconnected","connected","connecting","disconnecting"][s] ?? "unknown");
const ms = (h) => h * 60 * 60 * 1000;
const endFrom = (startDate, hours) => new Date(new Date(startDate).getTime() + ms(hours));

// ---------- Schemas (Joi) ----------
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const bookingCreateSchema = Joi.object({
  guideId: Joi.string().required(),
  date: Joi.date().iso().required(),
  hours: Joi.number().integer().min(1).max(12).required(),
});

// ---------- Models locales ----------
const bookingSchema = new mongoose.Schema({
  guide:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  traveler:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  date:      { type: Date, required: true },
  endDate:   { type: Date, required: true },
  hours:     { type: Number, required: true, min: 1, max: 12 },
  status:    { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending' },
}, { timestamps: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// ---------- Rutas base ----------
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
      return res.status(500).json({ ok:false, error:'No conectado a MongoDB' });
    }
    const col = mongoose.connection.db.collection('__ping');
    const doc = { at: new Date() };
    await col.insertOne(doc);
    const count = await col.countDocuments();
    res.json({ ok:true, insertedAt: doc.at, totalDocs: count });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// ---------- Auth ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.details[0].message });

    const exists = await Usuario.findOne({ email: value.email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ ok:false, error:'email ya registrado' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({
      nombre: value.nombre.trim(),
      email: value.email.toLowerCase().trim(),
      passwordHash,
    });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ ok:true, token });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.details[0].message });

    const user = await Usuario.findOne({ email: value.email.toLowerCase().trim() });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok:true, token });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const u = await Usuario.findById(req.user.id).select('_id nombre email createdAt updatedAt');
    if (!u) return res.status(404).json({ ok:false, error:'usuario no encontrado' });
    res.json({ ok:true, user: u });
  } catch (e) {
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

// ---------- Bookings ----------
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { value, error } = bookingCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.details[0].message });

    const travelerId = req.user.id;
    const guideId = value.guideId;
    if (String(travelerId) === String(guideId)) {
      return res.status(400).json({ ok:false, error:'no podés reservarte a vos mismo' });
    }

    const start = new Date(value.date);
    const end = endFrom(start, value.hours);

    // choque con otras reservas del guía (pending/confirmed)
    const overlap = await Booking.findOne({
      guide: guideId,
      status: { $in: ['pending','confirmed'] },
      date:   { $lt: end },
      endDate:{ $gt: start },
    });
    if (overlap) return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideId,
      traveler: travelerId,
      date: start,
      endDate: end,
      hours: value.hours,
      status: 'pending',
    });

    const [guide, traveler] = await Promise.all([
      Usuario.findById(guideId).select('nombre email'),
      Usuario.findById(travelerId).select('nombre email'),
    ]);

    res.status(201).json({
      ok:true,
      booking: {
        _id: booking._id,
        guide: guide ? { _id: guide._id, nombre: guide.nombre, email: guide.email } : null,
        traveler: traveler ? { _id: traveler._id, nombre: traveler.nombre, email: traveler.email } : null,
        date: booking.date,
        endDate: booking.endDate,
        hours: booking.hours,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      }
    });
  } catch (e) {
    console.error('POST /bookings error', e);
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const bookings = await Booking.find({
      $or: [{ guide: uid }, { traveler: uid }],
    }).sort({ date: 1 });

    // “populate manual” ligero
    const ids = new Set();
    bookings.forEach(b => { ids.add(String(b.guide)); ids.add(String(b.traveler)); });
    const users = await Usuario.find({ _id: { $in: [...ids] } }).select('nombre email');
    const map = Object.fromEntries(users.map(u => [String(u._id), u]));

    const out = bookings.map(b => ({
      _id: b._id,
      guide: map[String(b.guide)] ? { _id: map[String(b.guide)]._id, nombre: map[String(b.guide)].nombre, email: map[String(b.guide)].email } : null,
      traveler: map[String(b.traveler)] ? { _id: map[String(b.traveler)]._id, nombre: map[String(b.traveler)].nombre, email: map[String(b.traveler)].email } : null,
      date: b.date,
      endDate: b.endDate,
      hours: b.hours,
      status: b.status,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    res.json({ ok:true, bookings: out });
  } catch (e) {
    console.error('GET /bookings error', e);
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

app.get('/api/bookings/:id', auth, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b) return res.status(404).json({ ok:false, error:'reserva no encontrada' });

    const [guide, traveler] = await Promise.all([
      Usuario.findById(b.guide).select('nombre email'),
      Usuario.findById(b.traveler).select('nombre email'),
    ]);

    res.json({
      ok:true,
      booking: {
        _id: b._id,
        guide: guide ? { _id: guide._id, nombre: guide.nombre, email: guide.email } : null,
        traveler: traveler ? { _id: traveler._id, nombre: traveler.nombre, email: traveler.email } : null,
        date: b.date,
        endDate: b.endDate,
        hours: b.hours,
        status: b.status,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }
    });
  } catch (e) {
    console.error('GET /bookings/:id error', e);
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

// Política final: confirmar/cancelar (viajero puede cancelar hasta 24h antes)
app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'confirmed' | 'cancelled'
    if (!['confirmed','cancelled'].includes(status)) {
      return res.status(400).json({ ok:false, error:"status debe ser 'confirmed' o 'cancelled'" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ ok:false, error:'reserva no encontrada' });

    const isGuide = String(booking.guide) === String(req.user.id);
    const isTraveler = String(booking.traveler) === String(req.user.id);

    const now = new Date();
    const cutoff = new Date(booking.date);
    cutoff.setHours(cutoff.getHours() - 24);

    if (status === 'confirmed') {
      if (!isGuide) return res.status(403).json({ ok:false, error:'solo guía puede confirmar' });
      if (booking.status !== 'pending') {
        return res.status(409).json({ ok:false, error:'solo pending puede confirmarse' });
      }
    } else if (status === 'cancelled') {
      if (isGuide) {
        // guía puede cancelar pending/confirmed en cualquier momento
      } else if (isTraveler) {
        if (booking.status === 'pending') {
          // ok
        } else if (booking.status === 'confirmed') {
          if (now > cutoff) {
            return res.status(403).json({ ok:false, error:'ventana de cancelación del viajero vencida (<24h)' });
          }
        } else {
          return res.status(409).json({ ok:false, error:'estado no cancelable por viajero' });
        }
      } else {
        return res.status(403).json({ ok:false, error:'no autorizado a modificar esta reserva' });
      }
    }

    booking.status = status;
    await booking.save();

    const [guide, traveler] = await Promise.all([
      Usuario.findById(booking.guide).select('nombre email'),
      Usuario.findById(booking.traveler).select('nombre email')
    ]);

    return res.json({
      ok:true,
      booking: {
        _id: booking._id,
        guide: guide ? { _id: guide._id, nombre: guide.nombre, email: guide.email } : null,
        traveler: traveler ? { _id: traveler._id, nombre: traveler.nombre, email: traveler.email } : null,
        date: booking.date,
        endDate: booking.endDate,
        hours: booking.hours,
        status: booking.status,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      }
    });
  } catch (e) {
    console.error('PATCH /bookings/:id error', e);
    res.status(500).json({ ok:false, error:'error interno' });
  }
});

// ---------- Conexión DB ----------
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
