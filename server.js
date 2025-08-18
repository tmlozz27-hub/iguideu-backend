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
const GuideProfile = require('./models/GuideProfile');

const app = express();
app.use(cors());
app.use(express.json());

// ================== CONEXIÓN DB ==================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

// ================== RUTAS BASE ==================
app.get('/', (_req, res) => {
  res.send('I GUIDE U backend funcionando 🚀');
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

// ================== AUTH ==================
app.post('/api/auth/register', async (req, res) => {
  try {
    const schema = Joi.object({
      nombre: Joi.string().min(2).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
    });
    const { value, error } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error:error.details[0].message });

    const existe = await Usuario.findOne({ email: value.email });
    if (existe) return res.status(409).json({ ok:false, error:'usuario ya existe' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({ nombre:value.nombre, email:value.email, passwordHash });

    const token = jwt.sign({ id:user._id, email:user.email }, process.env.JWT_SECRET, { expiresIn:'7d' });
    res.status(201).json({ ok:true, token });
  } catch (err) {
    res.status(500).json({ ok:false, error:err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });
    const { value, error } = schema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error:error.details[0].message });

    const user = await Usuario.findOne({ email: value.email });
    if (!user) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = jwt.sign({ id:user._id, email:user.email }, process.env.JWT_SECRET, { expiresIn:'7d' });
    res.json({ ok:true, token });
  } catch (err) {
    res.status(500).json({ ok:false, error:err.message });
  }
});

app.get('/api/me', auth, async (req, res) => {
  const user = await Usuario.findById(req.user.id).select('-passwordHash').lean();
  if (!user) return res.status(404).json({ ok:false, error:'usuario no encontrado' });
  res.json({ ok:true, user });
});

// ================== CRUD USUARIOS ==================
app.get('/api/usuarios', async (_req, res) => {
  const users = await Usuario.find().select('-passwordHash').lean();
  res.json(users);
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre, email } = req.body;
  const user = await Usuario.create({ nombre, email });
  res.status(201).json({ ok:true, usuario:user });
});

// ================== CRUD GUIDE PROFILES ==================
app.put('/api/guides/me', auth, async (req, res) => {
  try {
    const { displayName, bio, languages, city, ratePerHour, available } = req.body;
    if (!displayName) return res.status(400).json({ ok:false, error:'displayName requerido' });

    const profile = await GuideProfile.findOneAndUpdate(
      { userId:req.user.id },
      { displayName, bio, languages, city, ratePerHour, available },
      { new:true, upsert:true, runValidators:true }
    );
    res.json({ ok:true, profile });
  } catch (err) {
    res.status(500).json({ ok:false, error:err.message });
  }
});

app.get('/api/guides/me', auth, async (req, res) => {
  const profile = await GuideProfile.findOne({ userId:req.user.id }).lean();
  if (!profile) return res.status(404).json({ ok:false, error:'sin perfil' });
  res.json({ ok:true, profile });
});

app.get('/api/guides', async (req, res) => {
  const q = {};
  if (req.query.city) q.city = new RegExp(`^${req.query.city}$`, 'i');
  if (req.query.lang) q.languages = req.query.lang;
  if (req.query.available) q.available = req.query.available === 'true';

  const items = await GuideProfile.find(q).sort({ createdAt:-1 }).lean();
  res.json({ ok:true, items });
});

app.get('/api/guides/:id', async (req, res) => {
  const profile = await GuideProfile.findById(req.params.id).lean();
  if (!profile) return res.status(404).json({ ok:false, error:'no encontrado' });
  res.json({ ok:true, profile });
});

app.delete('/api/guides/me', auth, async (req, res) => {
  const deleted = await GuideProfile.findOneAndDelete({ userId:req.user.id });
  if (!deleted) return res.status(404).json({ ok:false, error:'no encontrado' });
  res.json({ ok:true, deleted:deleted._id });
});

// ================== START ==================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
