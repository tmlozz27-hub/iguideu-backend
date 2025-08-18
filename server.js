// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const Usuario = require('./models/Usuario');
const GuideProfile = require('./models/GuideProfile');
const auth = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => console.error('❌ Error MongoDB', err));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Registro
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(409).json({ ok: false, error: 'Usuario ya existe' });

    const passwordHash = await bcrypt.hash(password, 10);
    const nuevo = await Usuario.create({ nombre, email, passwordHash });
    const token = jwt.sign({ id: nuevo._id, email: nuevo.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ ok: true, token });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Usuario.findOne({ email });
    if (!user) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

    const match = await bcrypt.compare(password, user.passwordHash || '');
    if (!match) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Perfil del usuario logueado
app.get('/api/me', auth, async (req, res) => {
  try {
    const user = await Usuario.findById(req.user.id).select('-passwordHash');
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Crear o actualizar perfil de guía
app.post('/api/guides', auth, async (req, res) => {
  try {
    const data = { ...req.body, user: req.user.id };
    const profile = await GuideProfile.findOneAndUpdate(
      { user: req.user.id },
      data,
      { new: true, upsert: true }
    );
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener todos los guías
app.get('/api/guides', async (req, res) => {
  try {
    const profiles = await GuideProfile.find().populate('user', 'nombre email');
    res.json({ ok: true, profiles });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

