// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');

const auth = require('./middleware/auth');
const Usuario = require('./models/Usuario');
const GuideProfile = require('./models/GuideProfile');
const Booking = require('./models/Booking');

const app = express();

// ---------- Middlewares básicos ----------
app.use(cors());
app.use(express.json());

// ---------- Conexión MongoDB ----------
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI en variables de entorno');
  process.exit(1);
}
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch((e) => {
    console.error('❌ Error conectando a MongoDB', e);
    process.exit(1);
  });

// ---------- Utilidades ----------
const isObjectId = (s) => /^[0-9a-fA-F]{24}$/.test(String(s || ''));

const userPublicProjection = 'nombre email';
const guidePublicProjection = 'user bio languages pricePerHour ratingAvg ratingCount available city country location createdAt updatedAt';
const bookingPopulate = [
  { path: 'guide', select: userPublicProjection, model: 'Usuario' },
  { path: 'traveler', select: userPublicProjection, model: 'Usuario' },
];

// ---------- Rutas base ----------
app.get('/', (_req, res) => {
  res.send('I GUIDE U backend funcionando');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState:
      ['disconnected', 'connected', 'connecting', 'disconnecting'][
        mongoose.connection.readyState
      ] ?? 'unknown',
  });
});

app.get('/api/dbtest', async (_req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ ok: true, mongo: 'pong', at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'db error', detail: e.message });
  }
});

// ---------- Auth ----------
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const exists = await Usuario.findOne({ email: value.email.toLowerCase() });
    if (exists) return res.status(409).json({ ok: false, error: 'email ya registrado' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({
      nombre: value.nombre,
      email: value.email.toLowerCase(),
      passwordHash,
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      ok: true,
      user: { id: user._id, nombre: user.nombre, email: user.email },
      token,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const user = await Usuario.findOne({ email: value.email.toLowerCase() });
    if (!user || !user.passwordHash)
      return res.status(401).json({ ok: false, error: 'credenciales inválidas' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'credenciales inválidas' });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      user: { id: user._id, nombre: user.nombre, email: user.email },
      token,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const me = await Usuario.findById(req.user.id).select(userPublicProjection);
    if (!me) return res.status(404).json({ ok: false, error: 'usuario no encontrado' });
    res.json({ ok: true, user: me });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Guides ----------

// GET /api/guides/me
app.get('/api/guides/me', auth, async (req, res) => {
  try {
    const guide = await GuideProfile.findOne({ user: req.user.id })
      .populate('user', userPublicProjection);
    if (!guide) return res.status(404).json({ ok: false, error: 'guide profile no encontrado' });
    res.json({ ok: true, guide });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PUT /api/guides/me  (con saneo de userId legacy)
app.put('/api/guides/me', auth, async (req, res, next) => {
  try {
    // Limpieza de legacy
    await GuideProfile.updateMany(
      { userId: { $exists: true } },
      { $unset: { userId: 1 } }
    );
    await GuideProfile.deleteMany({ $or: [{ user: null }, { user: { $exists: false } }] });

    // Validación simple
    const schema = Joi.object({
      bio: Joi.string().max(1000).allow('', null),
      pricePerHour: Joi.number().min(0).max(10000).allow(null),
      languages: Joi.array().items(Joi.string()).allow(null),
      city: Joi.string().max(200).allow('', null),
      country: Joi.string().max(200).allow('', null),
      available: Joi.boolean().allow(null),
    });

    const { value, error } = schema.validate(req.body ?? {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const update = {
      $set: {
        user: req.user.id,
        ...(value.bio !== undefined ? { bio: value.bio } : {}),
        ...(value.pricePerHour !== undefined ? { pricePerHour: value.pricePerHour } : {}),
        ...(value.languages !== undefined ? { languages: value.languages } : {}),
        ...(value.city !== undefined ? { city: value.city } : {}),
        ...(value.country !== undefined ? { country: value.country } : {}),
        ...(value.available !== undefined ? { available: value.available } : {}),
      },
      $unset: { userId: '' },
    };

    const guide = await GuideProfile.findOneAndUpdate(
      { user: req.user.id },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).populate('user', userPublicProjection);

    res.json({ ok: true, guide });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: 'Conflicto de índice único (userId). Reintenta; el saneo ya lo remueve.',
      });
    }
    next(err);
  }
});

// GET /api/guides (búsqueda)
app.get('/api/guides', async (req, res) => {
  try {
    const { city, country, language, maxPrice } = req.query;
    const q = {};

    if (city) q.city = city;
    if (country) q.country = country;
    if (language) q.languages = { $in: [language] };
    if (maxPrice) q.pricePerHour = { $lte: Number(maxPrice) };

    const guides = await GuideProfile.find(q)
      .populate('user', userPublicProjection)
      .select(guidePublicProjection);

    res.json({ ok: true, guides });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/guides/:userId  (detalle por usuario guía)
app.get('/api/guides/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) return res.status(400).json({ ok: false, error: 'userId inválido' });

    const guide = await GuideProfile.findOne({ user: userId })
      .populate('user', userPublicProjection);

    if (!guide) return res.status(404).json({ ok: false, error: 'guide profile no encontrado' });

    res.json({ ok: true, guide });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Bookings ----------

const bookingCreateSchema = Joi.object({
  guideId: Joi.string().required(),
  date: Joi.string().isoDate().required(),
  hours: Joi.number().integer().min(1).max(12).required(),
});

// solapamiento: (a < B) && (b > A)
const overlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

// POST /api/bookings
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { value, error } = bookingCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const guideId = value.guideId;
    if (!isObjectId(guideId)) return res.status(400).json({ ok: false, error: 'guideId inválido' });
    if (guideId === req.user.id)
      return res.status(400).json({ ok: false, error: 'no puedes reservarte a ti mismo' });

    // fecha futura
    const start = new Date(value.date);
    if (isNaN(start.getTime())) return res.status(400).json({ ok: false, error: 'date inválida' });
    if (start <= new Date()) return res.status(400).json({ ok: false, error: 'date debe ser futura' });

    const hours = value.hours;
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

    // guía disponible?
    const guideProfile = await GuideProfile.findOne({ user: guideId });
    if (!guideProfile || guideProfile.available === false)
      return res.status(400).json({ ok: false, error: 'guía no disponible' });

    // solapamiento con reservas del guía (no canceladas)
    const existing = await Booking.find({
      guide: guideId,
      status: { $ne: 'cancelled' },
      date: { $lt: end },
      endDate: { $gt: start },
    });

    if (existing.length > 0)
      return res.status(409).json({ ok: false, error: 'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideId,
      traveler: req.user.id,
      date: start,
      endDate: end,
      hours,
      status: 'pending',
    });

    const populated = await Booking.findById(booking._id).populate(bookingPopulate);
    res.status(201).json({ ok: true, booking: populated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/bookings (mis reservas como guía o viajero)
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const myId = req.user.id;

    const bookings = await Booking.find({
      $or: [{ guide: myId }, { traveler: myId }],
    })
      .sort({ date: 1 })
      .populate(bookingPopulate);

    res.json({ ok: true, bookings });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/bookings/:id (detalle)
app.get('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ ok: false, error: 'id inválido' });

    const booking = await Booking.findById(id).populate(bookingPopulate);
    if (!booking) return res.status(404).json({ ok: false, error: 'booking no encontrado' });

    // debe ser parte
    if (
      booking.guide._id.toString() !== req.user.id &&
      booking.traveler._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ ok: false, error: 'no autorizado' });
    }

    res.json({ ok: true, booking });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PATCH /api/bookings/:id (cambiar estado)
const bookingStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled').required(),
});

app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ ok: false, error: 'id inválido' });

    const { value, error } = bookingStatusSchema.validate(req.body);
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ ok: false, error: 'booking no encontrado' });

    const me = req.user.id;
    const isGuide = booking.guide.toString() === me;
    const isTraveler = booking.traveler.toString() === me;

    if (!isGuide && !isTraveler) return res.status(403).json({ ok: false, error: 'no autorizado' });
    if (booking.status === 'cancelled')
      return res.status(400).json({ ok: false, error: 'ya está cancelada' });

    const now = new Date();
    const start = new Date(booking.date);
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (value.status === 'confirmed') {
      // Sólo el guía puede confirmar
      if (!isGuide) return res.status(403).json({ ok: false, error: 'solo el guía puede confirmar' });
      if (booking.status !== 'pending')
        return res.status(400).json({ ok: false, error: 'solo se confirman reservas pending' });

      booking.status = 'confirmed';
      await booking.save();
      const populated = await Booking.findById(id).populate(bookingPopulate);
      return res.json({ ok: true, booking: populated });
    }

    if (value.status === 'cancelled') {
      // El guía puede cancelar siempre; el viajero sólo si faltan >24h
      if (isGuide) {
        booking.status = 'cancelled';
        await booking.save();
        const populated = await Booking.findById(id).populate(bookingPopulate);
        return res.json({ ok: true, booking: populated });
      }

      if (isTraveler) {
        if (diffHours <= 24)
          return res.status(403).json({ ok: false, error: 'viajero no puede cancelar con menos de 24h' });

        booking.status = 'cancelled';
        await booking.save();
        const populated = await Booking.findById(id).populate(bookingPopulate);
        return res.json({ ok: true, booking: populated });
      }
    }

    return res.status(400).json({ ok: false, error: 'operación inválida' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- Manejador de errores ----------
app.use((err, _req, res, _next) => {
  console.error('ERROR:', err);
  res.status(500).json({ ok: false, error: 'internal_error', detail: err.message });
});

// ---------- Arranque ----------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
