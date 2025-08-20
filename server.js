// server.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

// ======= Config =======
const app = express();
app.use(helmet({
  // permitimos JSON Sniffing protection, XSS, etc.
  crossOriginResourcePolicy: { policy: 'cross-origin' } // para que no bloquee imágenes si las hay
}));
app.use(express.json({ limit: '1mb' }));

// CORS sencillo para no bloquearte durante dev
app.use(cors());

// Rate limit suave sólo en auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 100, // 100 req por IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// ======= Conexión Mongo =======
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI no definido');
  process.exit(1);
}
mongoose.set('strictQuery', true);
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch((e) => {
    console.error('❌ Error conectando MongoDB', e);
    process.exit(1);
  });

// ======= Modelos =======
const Usuario = require('./models/Usuario');
const GuideProfile = require('./models/GuideProfile');
const Booking = require('./models/Booking');
const Review = require('./models/Review');

// ======= Middleware Auth =======
const auth = require('./middleware/auth');

// ======= Utils =======
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET no definido');
  process.exit(1);
}

const isObjectId = (id) => mongoose.isValidObjectId(id);

// ======= Rutas básicas =======
app.get('/', (_req, res) => {
  res.send('I GUIDE U backend funcionando');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: ["disconnected","connected","connecting","disconnecting"][mongoose.connection.readyState] ?? "unknown",
  });
});

// ======= Auth =======
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const exists = await Usuario.findOne({ email: value.email.toLowerCase().trim() }).lean();
    if (exists) return res.status(409).json({ ok:false, error: 'email ya registrado' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({
      nombre: value.nombre.trim(),
      email: value.email.toLowerCase().trim(),
      passwordHash,
    });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      ok: true,
      user: { id: user._id, nombre: user.nombre, email: user.email },
      token
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const user = await Usuario.findOne({ email: value.email.toLowerCase().trim() });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok:true, token });
  } catch (err) {
    next(err);
  }
});

app.get('/api/me', auth, async (req, res, next) => {
  try {
    const u = await Usuario.findById(req.user.id).lean();
    if (!u) return res.status(404).json({ ok:false, error: 'no encontrado' });
    res.json({ ok:true, user: { _id: u._id, nombre: u.nombre, email: u.email, createdAt: u.createdAt, updatedAt: u.updatedAt } });
  } catch (err) {
    next(err);
  }
});

// ======= Guides =======

// GET /api/guides?city=&language=&maxPrice=
app.get('/api/guides', async (req, res, next) => {
  try {
    const { city, language, maxPrice } = req.query;
    const q = {};

    if (city) {
      q.city = { $regex: new RegExp(city, 'i') };
    }
    if (language) {
      q.languages = { $in: [ language.toString().toLowerCase() ] };
    }
    if (maxPrice) {
      const mp = Number(maxPrice);
      if (!Number.isNaN(mp)) q.pricePerHour = { $lte: mp };
    }

    // por defecto listamos solo disponibles; si no querés, comenta la línea de abajo
    // q.available = true;

    const guides = await GuideProfile.find(q)
      .populate({ path: 'user', select: '_id nombre email' })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ ok:true, guides });
  } catch (err) {
    next(err);
  }
});

// GET /api/guides/:userId  (detalle por id de Usuario)
app.get('/api/guides/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) return res.status(400).json({ ok:false, error:'userId inválido' });

    const guide = await GuideProfile.findOne({ user: userId })
      .populate({ path: 'user', select: '_id nombre email' })
      .lean();

    if (!guide) return res.status(404).json({ ok:false, error:'guía no encontrado' });
    res.json({ ok:true, guide });
  } catch (err) {
    next(err);
  }
});

// GET /api/guides/me  (si no existe, lo crea vacío)
app.get('/api/guides/me', auth, async (req, res, next) => {
  try {
    let guide = await GuideProfile.findOne({ user: req.user.id })
      .populate({ path: 'user', select: '_id nombre email' });

    if (!guide) {
      guide = await GuideProfile.create({ user: req.user.id });
      guide = await guide.populate({ path: 'user', select: '_id nombre email' });
    }

    res.json({ ok:true, guide });
  } catch (err) {
    next(err);
  }
});

const upsertGuideSchema = Joi.object({
  bio: Joi.string().max(1000).allow('', null),
  pricePerHour: Joi.number().min(1).max(1000),
  languages: Joi.array().items(Joi.string().lowercase()).max(10),
  city: Joi.string().max(100),
  country: Joi.string().max(100),
  available: Joi.boolean()
});

app.put('/api/guides/me', auth, async (req, res, next) => {
  try {
    const { value, error } = upsertGuideSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const update = { $set: {} , $setOnInsert: { user: req.user.id } };
    for (const k of ['bio','pricePerHour','languages','city','country','available']) {
      if (typeof value[k] !== 'undefined') update.$set[k] = value[k];
    }

    const guide = await GuideProfile.findOneAndUpdate(
      { user: req.user.id },
      update,
      { new: true, upsert: true }
    ).populate({ path: 'user', select: '_id nombre email' });

    res.json({ ok:true, guide });
  } catch (err) {
    // capturamos índices únicos nulos
    if (err && err.code === 11000) {
      return res.status(409).json({ ok:false, error: 'perfil duplicado' });
    }
    next(err);
  }
});

// ======= Reviews =======

// POST /api/guides/:userId/reviews  (crea reseña y recalcula rating)
const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('', null)
});

app.post('/api/guides/:userId/reviews', auth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) return res.status(400).json({ ok:false, error:'userId inválido' });

    const { value, error } = reviewSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    // Validar que exista el guía
    const guideProfile = await GuideProfile.findOne({ user: userId }).lean();
    if (!guideProfile) return res.status(404).json({ ok:false, error:'guía no encontrado' });

    // (Regla flexible) Requerimos al menos una reserva (cualquier estado) entre traveler y guide.
    const anyBooking = await Booking.exists({ guide: userId, traveler: req.user.id });
    if (!anyBooking) {
      return res.status(403).json({ ok:false, error:'sólo viajeros con reserva pueden reseñar' });
    }

    // Crear review
    const review = await Review.create({
      guide: userId,
      traveler: req.user.id,
      rating: value.rating,
      comment: value.comment ?? ''
    });

    // Recalcular rating
    const agg = await Review.aggregate([
      { $match: { guide: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$guide', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const avg = agg[0]?.avg ?? 0;
    const count = agg[0]?.count ?? 0;

    await GuideProfile.updateOne(
      { user: userId },
      { $set: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count } }
    );

    res.status(201).json({ ok:true, review });
  } catch (err) {
    next(err);
  }
});

// GET /api/guides/:userId/reviews?page=&limit=
app.get('/api/guides/:userId/reviews', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isObjectId(userId)) return res.status(400).json({ ok:false, error:'userId inválido' });

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Review.find({ guide: userId })
        .populate({ path: 'traveler', select: '_id nombre email' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ guide: userId })
    ]);

    res.json({
      ok: true,
      page,
      limit,
      total,
      reviews: items
    });
  } catch (err) {
    next(err);
  }
});

// ======= Bookings =======

const bookingCreateSchema = Joi.object({
  guideId: Joi.string().required(),
  date: Joi.string().isoDate().required(),
  hours: Joi.number().integer().min(1).max(12).required()
});

app.post('/api/bookings', auth, async (req, res, next) => {
  try {
    const { value, error } = bookingCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const guideId = value.guideId;
    if (!isObjectId(guideId)) return res.status(400).json({ ok:false, error:'guideId inválido' });

    if (guideId === req.user.id) return res.status(400).json({ ok:false, error:'no podés reservarte a vos mismo' });

    const start = new Date(value.date);
    if (isNaN(start.getTime())) return res.status(400).json({ ok:false, error:'date inválida' });
    const end = new Date(start.getTime() + value.hours * 60 * 60 * 1000);

    // Chequear que el guía exista
    const guideExists = await Usuario.exists({ _id: guideId });
    if (!guideExists) return res.status(404).json({ ok:false, error:'guía no encontrado' });

    // Solapamiento (para el guía, que no esté cancelado)
    const overlap = await Booking.exists({
      guide: guideId,
      status: { $ne: 'cancelled' },
      $or: [
        { date: { $lt: end }, endDate: { $gt: start } }, // intervalo [date, endDate) solapa
      ]
    });
    if (overlap) return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideId,
      traveler: req.user.id,
      date: start,
      endDate: end,
      hours: value.hours,
      status: 'pending'
    });

    const populated = await Booking.findById(booking._id)
      .populate({ path: 'guide traveler', select: '_id nombre email' })
      .lean();

    res.status(201).json({ ok:true, booking: populated });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings (del usuario: como guía o viajero)
app.get('/api/bookings', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const bookings = await Booking.find({
      $or: [{ guide: userId }, { traveler: userId }]
    })
      .sort({ date: -1 })
      .populate({ path: 'guide traveler', select: '_id nombre email' })
      .lean();

    res.json({ ok:true, bookings });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id (detalle si es tuyo)
app.get('/api/bookings/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });

    const booking = await Booking.findById(id)
      .populate({ path: 'guide traveler', select: '_id nombre email' });

    if (!booking) return res.status(404).json({ ok:false, error:'reserva no encontrada' });
    const uid = req.user.id;
    if (booking.guide._id.toString() !== uid && booking.traveler._id.toString() !== uid) {
      return res.status(403).json({ ok:false, error:'sin permiso' });
    }

    res.json({ ok:true, booking });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bookings/:id  (status: confirmed/cancelled)
const bookingUpdateSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'cancelled').required()
});

app.patch('/api/bookings/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });

    const { value, error } = bookingUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ ok:false, error:'reserva no encontrada' });

    const uid = req.user.id;
    const isGuide = booking.guide.toString() === uid;
    const isTraveler = booking.traveler.toString() === uid;

    if (!isGuide && !isTraveler) return res.status(403).json({ ok:false, error:'sin permiso' });

    // Política
    if (value.status === 'confirmed') {
      if (!isGuide) return res.status(403).json({ ok:false, error:'sólo el guía puede confirmar' });
      // Si ya estaba cancelada, no se puede confirmar
      if (booking.status === 'cancelled') return res.status(400).json({ ok:false, error:'reserva cancelada; no se puede confirmar' });
      booking.status = 'confirmed';
    } else if (value.status === 'cancelled') {
      if (isGuide) {
        // guía puede cancelar siempre
        booking.status = 'cancelled';
      } else if (isTraveler) {
        // viajero puede cancelar solo si faltan >=24h
        const now = new Date();
        const limit = new Date(booking.date.getTime() - 24 * 60 * 60 * 1000);
        if (now > limit) {
          return res.status(403).json({ ok:false, error:'viajero no puede cancelar con menos de 24h' });
        }
        booking.status = 'cancelled';
      }
    }

    await booking.save();
    const populated = await Booking.findById(booking._id)
      .populate({ path: 'guide traveler', select: '_id nombre email' })
      .lean();

    res.json({ ok:true, booking: populated });
  } catch (err) {
    next(err);
  }
});

// ======= Error handler =======
app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(500).json({ ok:false, error: 'error_interno' });
});

// ======= Server =======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

