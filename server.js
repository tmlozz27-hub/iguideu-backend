// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Middleware propio (JWT)
const auth = require('./middleware/auth');
// Modelo de usuario (ya creado en models/Usuario.js)
const Usuario = require('./models/Usuario');

const app = express();
app.use(cors());
app.use(express.json());

// ------------------ Mongo ------------------
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error al conectar MongoDB:', err));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

function mongoStateLabel(state) {
  return ["disconnected","connected","connecting","disconnecting"][state] ?? "unknown";
}

// ------------------ Health ------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

// ------------------ Booking Schema/Model ------------------
const bookingSchema = new mongoose.Schema({
  guide:     { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traveler:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  date:      { type: Date, required: true, index: true },       // inicio
  endDate:   { type: Date, required: true, index: true },       // fin calculado
  hours:     { type: Number, required: true, min: 1, max: 12 }, // duración
  status:    { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending', index: true },
}, { timestamps: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// ------------------ Helpers ------------------
const HOURS_MAX = 12;
const toDate = (d) => {
  const x = new Date(d);
  return isNaN(x.getTime()) ? null : x;
};

// ------------------ Rutas Auth MÍNIMAS (si ya las tenías, mantené las tuyas) ------------------
// Nota: tus rutas /api/auth/register y /api/auth/login ya existen en este repo según ayer.
// Si por alguna razón no están, avisame y te paso el bloque completo nuevamente.

// ------------------ Bookings ------------------

/**
 * Crear booking (viajero autenticado)
 * Body: { guideId, date (ISO), hours }
 * Reglas: hours 1..12, guía existente, sin solapamiento con bookings 'pending' o 'confirmed'
 */
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { guideId, date, hours } = req.body;

    if (!guideId || !date || !hours) {
      return res.status(400).json({ ok: false, error: 'guideId, date y hours son requeridos' });
    }
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > HOURS_MAX) {
      return res.status(400).json({ ok: false, error: `hours debe ser un número entre 1 y ${HOURS_MAX}` });
    }

    const start = toDate(date);
    if (!start) return res.status(400).json({ ok:false, error:'date inválida' });

    const end = new Date(start.getTime() + h * 60 * 60 * 1000);

    const guide = await Usuario.findById(guideId);
    if (!guide) return res.status(404).json({ ok:false, error:'Guía no encontrado' });

    // Solapamiento: (existente.start < nuevo.end) && (existente.end > nuevo.start)
    const overlap = await Booking.findOne({
      guide: guideId,
      status: { $in: ['pending','confirmed'] },
      date:   { $lt: end },
      endDate:{ $gt: start },
    }).lean();

    if (overlap) {
      return res.status(409).json({ ok:false, error:'Horario no disponible para el guía (solapamiento)' });
    }

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

    return res.status(201).json({ ok:true, booking: populated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'error creando booking' });
  }
});

/**
 * Listar bookings del usuario autenticado
 * - por defecto lista como traveler (sus reservas)
 * - ?as=guide para listar como guía
 */
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const as = (req.query.as || '').toString().toLowerCase();
    const filter = (as === 'guide')
      ? { guide: req.user.id }
      : { traveler: req.user.id };

    const bookings = await Booking.find(filter)
      .sort({ date: 1 })
      .populate('guide', 'nombre email')
      .populate('traveler', 'nombre email')
      .lean();

    return res.json({ ok:true, bookings });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'error listando bookings' });
  }
});

/**
 * Detalle de booking
 * - sólo puede verlo quien sea el guide o el traveler de la reserva
 */
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
    return res.json({ ok:true, booking: b });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'error obteniendo booking' });
  }
});

/**
 * Cambiar estado (confirm/cancel)
 * - sólo el guía puede cambiar el estado de su booking
 * Body opcional: { status: 'confirmed' | 'cancelled' }
 */
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

    return res.json({ ok:true, booking: populated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'error actualizando booking' });
  }
});

// ------------------ Raíz ------------------
app.get('/', (_req, res) => res.send('I GUIDE U backend funcionando'));

// ------------------ Start ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));


