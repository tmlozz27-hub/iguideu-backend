// server.js
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcrypt');

// ===== Models & middleware =====
const Usuario      = require('./models/Usuario');
const GuideProfile = require('./models/GuideProfile');
const auth         = require('./middleware/auth');

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== Utils =====
function mongoStateLabel(state) {
  return ["disconnected","connected","connecting","disconnecting"][state] ?? "unknown";
}
function ensureObjectId(id) {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
}

// ===== Health =====
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

// ===== Auth =====
// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body || {};
    if (!nombre || String(nombre).trim().length < 2) return res.status(400).json({ ok:false, error:'nombre inválido' });
    if (!email  || !/^\S+@\S+\.\S+$/.test(email))     return res.status(400).json({ ok:false, error:'email inválido' });
    if (!password || String(password).length < 8)      return res.status(400).json({ ok:false, error:'password mínimo 8' });

    const exists = await Usuario.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ ok:false, error:'email ya registrado' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await Usuario.create({ nombre: String(nombre).trim(), email: String(email).toLowerCase().trim(), passwordHash });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ ok:true, token, user: { id:user._id, nombre:user.nombre, email:user.email } });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok:false, error:'email y password requeridos' });

    const user = await Usuario.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok:true, token, user: { id:user._id, nombre:user.nombre, email:user.email } });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Me
app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).select('_id nombre email createdAt updatedAt');
    res.json({ ok:true, user });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// ===== Booking schema (in-file) =====
const bookingSchema = new mongoose.Schema({
  guide:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traveler:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  date:      { type: Date, required: true, index: true }, // inicio
  endDate:   { type: Date, required: true, index: true }, // fin
  hours:     { type: Number, required: true, min: 1, max: 24 },
  status:    { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending', index: true }
}, { timestamps: true });

bookingSchema.index({ guide:1, date:1, endDate:1 });
bookingSchema.index({ traveler:1, date:1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// ===== Bookings =====
// Crear booking (viajero crea)
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { guideId, date, hours } = req.body || {};
    const guideObjId = ensureObjectId(guideId);
    if (!guideObjId) return res.status(400).json({ ok:false, error:'guideId inválido' });

    const start = new Date(date);
    if (isNaN(start.getTime())) return res.status(400).json({ ok:false, error:'date inválida' });

    const hrs = Number(hours);
    if (!Number.isFinite(hrs) || hrs < 1 || hrs > 24) return res.status(400).json({ ok:false, error:'hours inválidas (1-24)' });

    const end = new Date(start.getTime() + hrs * 60 * 60 * 1000);

    // solapamiento para el guía
    const overlap = await Booking.findOne({
      guide: guideObjId,
      status: { $ne: 'cancelled' },
      $or: [
        { date: { $lt: end }, endDate: { $gt: start } }, // rangos que se cruzan
      ]
    });

    if (overlap) return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });

    const booking = await Booking.create({
      guide: guideObjId,
      traveler: ensureObjectId(req.user.id),
      date: start,
      endDate: end,
      hours: hrs,
      status: 'pending'
    });

    const populated = await Booking.findById(booking._id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email');

    res.status(201).json({ ok:true, booking: populated });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// Listar mis bookings (guía o viajero)
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const me = ensureObjectId(req.user.id);
    const items = await Booking.find({ $or: [ { guide: me }, { traveler: me } ] })
      .sort({ date: -1 })
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email');
    res.json({ ok:true, bookings: items });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// Detalle booking (sólo participantes)
app.get('/api/bookings/:id', auth, async (req, res) => {
  try {
    const id = ensureObjectId(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'id inválido' });

    const b = await Booking.findById(id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email');

    if (!b) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    const me = req.user.id;
    if (b.guide?._id?.toString() !== me && b.traveler?._id?.toString() !== me) {
      return res.status(403).json({ ok:false, error:'sin permiso' });
    }

    res.json({ ok:true, booking: b });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// Actualizar estado (política):
// - Guía puede confirmar/cancelar siempre.
// - Viajero sólo puede cancelar y sólo si faltan >= 24h.
app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const id = ensureObjectId(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'id inválido' });

    let { status } = req.body || {};
    if (typeof status !== 'string') return res.status(400).json({ ok:false, error:"status debe ser 'confirmed' o 'cancelled'" });
    status = status.trim().toLowerCase();
    if (!['confirmed','cancelled'].includes(status)) {
      return res.status(400).json({ ok:false, error:"status debe ser 'confirmed' o 'cancelled'" });
    }

    const b = await Booking.findById(id);
    if (!b) return res.status(404).json({ ok:false, error:'booking no encontrado' });

    const me = req.user.id;
    const isGuide    = b.guide?.toString() === me;
    const isTraveler = b.traveler?.toString() === me;

    if (!isGuide && !isTraveler) return res.status(403).json({ ok:false, error:'sin permiso' });

    if (isGuide) {
      // guía puede confirmar o cancelar
      b.status = status;
    } else {
      // viajero: solo cancelar y con antelación >= 24h
      if (status !== 'cancelled') {
        return res.status(403).json({ ok:false, error:'el viajero sólo puede cancelar' });
      }
      const now = new Date();
      const diffMs = b.date.getTime() - now.getTime();
      const hoursLeft = diffMs / (1000 * 60 * 60);
      if (hoursLeft < 24) {
        return res.status(403).json({ ok:false, error:'no se puede cancelar con menos de 24h' });
      }
      b.status = 'cancelled';
    }

    await b.save();

    const populated = await Booking.findById(b._id)
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email');

    res.json({ ok:true, booking: populated });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// ===== GuideProfile =====
// Mi perfil (guía)
app.get('/api/guides/me', auth, async (req, res) => {
  try {
    const profile = await GuideProfile.findOne({ user: req.user.id });
    res.json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Upsert mi perfil
app.put('/api/guides/me', auth, async (req, res) => {
  try {
    const { bio, city, country, languages, pricePerHour } = req.body || {};

    if (pricePerHour != null && (typeof pricePerHour !== 'number' || pricePerHour < 0 || pricePerHour > 10000)) {
      return res.status(400).json({ ok:false, error: 'pricePerHour inválido' });
    }
    if (languages && !Array.isArray(languages)) {
      return res.status(400).json({ ok:false, error: 'languages debe ser array de strings' });
    }

    const update = { bio, city, country, languages, pricePerHour };
    const profile = await GuideProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Búsqueda pública de guías
app.get('/api/guides', async (req, res) => {
  try {
    const { q, city, country, lang, minPrice, maxPrice, sort = 'price', page = 1, limit = 10 } = req.query;

    const filter = {};
    if (city)    filter.city = new RegExp(`^${String(city).trim()}`, 'i');
    if (country) filter.country = new RegExp(`^${String(country).trim()}`, 'i');
    if (lang)    filter.languages = { $in: [ String(lang).toLowerCase() ] };

    if (minPrice != null || maxPrice != null) {
      filter.pricePerHour = {};
      if (minPrice != null) filter.pricePerHour.$gte = Number(minPrice);
      if (maxPrice != null) filter.pricePerHour.$lte = Number(maxPrice);
    }

    if (q) {
      const rx = new RegExp(String(q).trim(), 'i');
      filter.$or = [{ bio: rx }, { city: rx }, { country: rx }];
    }

    const sortMap = {
      'price':   { pricePerHour: 1 },
      '-price':  { pricePerHour: -1 },
      'rating':  { ratingAvg: 1, ratingCount: -1 },
      '-rating': { ratingAvg: -1, ratingCount: -1 },
      'recent':  { createdAt: 1 },
      '-recent': { createdAt: -1 },
    };
    const sortObj = sortMap[sort] || { pricePerHour: 1 };

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const [items, total] = await Promise.all([
      GuideProfile.find(filter)
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('user', 'nombre email'),
      GuideProfile.countDocuments(filter)
    ]);

    res.json({ ok: true, total, page: pageNum, pageSize: items.length, items });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// Ver un perfil público por id
app.get('/api/guides/:id', async (req, res) => {
  try {
    const id = ensureObjectId(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'id inválido' });

    const profile = await GuideProfile.findById(id).populate('user', 'nombre email');
    if (!profile) return res.status(404).json({ ok:false, error:'perfil no encontrado' });

    res.json({ ok:true, profile });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// ===== Conexión Mongo =====
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
