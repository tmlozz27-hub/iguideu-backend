// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');          // si en Render diera drama, podrías usar 'bcryptjs'
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Modelos y middleware
const Usuario = require('./models/Usuario');
const GuideProfile = require('./models/GuideProfile');
const Booking = require('./models/Booking');
const auth = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// ===== Conexión a MongoDB =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err.message));

// ===== Healthcheck =====
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ===== Auth: Register =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ ok:false, error:'nombre, email y password son requeridos' });
    }
    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(409).json({ ok:false, error:'Usuario ya existe' });

    const passwordHash = await bcrypt.hash(password, 10);
    const nuevo = await Usuario.create({ nombre, email, passwordHash });

    const token = jwt.sign({ id: nuevo._id, email: nuevo.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ ok:true, token });
  } catch (err) {
    console.error('REGISTER', err);
    res.status(500).json({ ok:false, error:'Error en servidor' });
  }
});

// ===== Auth: Login =====
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Usuario.findOne({ email });
    if (!user) return res.status(401).json({ ok:false, error:'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ ok:false, error:'Credenciales inválidas' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok:true, token });
  } catch (err) {
    console.error('LOGIN', err);
    res.status(500).json({ ok:false, error:'Error en servidor' });
  }
});

// ===== Perfil del usuario logueado =====
app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).select('-passwordHash');
    res.json({ ok:true, user });
  } catch (err) {
    console.error('ME', err);
    res.status(500).json({ ok:false, error:'Error en servidor' });
  }
});

// ===== Guides: crear/actualizar perfil del guía (upsert) =====
app.post('/api/guides', auth, async (req, res) => {
  try {
    const data = {
      user: req.user.id,
      bio: req.body.bio || '',
      languages: Array.isArray(req.body.languages) ? req.body.languages : [],
      location: req.body.location || '',
      pricePerHour: req.body.pricePerHour ?? null,
    };

    const profile = await GuideProfile.findOneAndUpdate(
      { user: req.user.id },
      data,
      { new: true, upsert: true }
    );
    res.json({ ok:true, profile });
  } catch (err) {
    console.error('GUIDES POST', err);
    res.status(500).json({ ok:false, error:'Error guardando perfil de guía' });
  }
});

// ===== Guides: listar todos los guías =====
app.get('/api/guides', async (_req, res) => {
  try {
    const profiles = await GuideProfile.find().populate('user', 'nombre email');
    res.json({ ok:true, profiles });
  } catch (err) {
    console.error('GUIDES GET', err);
    res.status(500).json({ ok:false, error:'Error listando guías' });
  }
});

// ===== Bookings: crear reserva (el usuario logueado es traveler) =====
app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { guideId, date, hours } = req.body;
    if (!guideId || !date) {
      return res.status(400).json({ ok:false, error:'guideId y date son requeridos' });
    }
    const booking = await Booking.create({
      guide: guideId,
      traveler: req.user.id,
      date: new Date(date),
      status: 'pending',
    });
    res.status(201).json({ ok:true, booking });
  } catch (err) {
    console.error('BOOKINGS POST', err);
    res.status(500).json({ ok:false, error:'Error creando booking' });
  }
});

// ===== Bookings: listar mis reservas (como guía o viajero) =====
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [{ traveler: req.user.id }, { guide: req.user.id }]
    })
    .populate('guide', 'nombre email')
    .populate('traveler', 'nombre email');

    res.json({ ok:true, bookings });
  } catch (err) {
    console.error('BOOKINGS GET', err);
    res.status(500).json({ ok:false, error:'Error listando bookings' });
  }
});

// ===== Arranque servidor =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});


