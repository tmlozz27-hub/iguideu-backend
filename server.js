// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Joi = require('joi');

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== Helpers =====
const mongoStateLabel = (s) => (["disconnected","connected","connecting","disconnecting"][s] ?? "unknown");

// ===== Modelo Usuario (inline) =====
const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2 },
    email:  { type: String, required: true, unique: true, lowercase: true, trim: true },
    // opcional para compatibilidad con registros viejos sin password
    passwordHash: { type: String }
  },
  { timestamps: true }
);
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

// ===== Auth middleware =====
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ ok:false, error:'token requerido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, email }
    next();
  } catch {
    return res.status(401).json({ ok:false, error:'token inválido' });
  }
}

// ===== Rutas básicas =====
app.get('/', (_req, res) => {
  res.send('I GUIDE U backend funcionando');
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    hasMongoUri: !!process.env.MONGODB_URI,
    dbState: mongoStateLabel(mongoose.connection.readyState),
  });
});

// ===== Ruta de test DB (inserta y cuenta docs en __ping) =====
app.get('/api/dbtest', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ ok: false, error: "No conectado a MongoDB" });
    }
    const col = mongoose.connection.db.collection("__ping");
    const doc = { at: new Date() };
    await col.insertOne(doc);
    const count = await col.countDocuments();
    res.json({ ok: true, insertedAt: doc.at, totalDocs: count });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== Validaciones Auth =====
const registerSchema = Joi.object({
  nombre: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// ===== Auth =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const exists = await Usuario.findOne({ email: value.email });
    if (exists) return res.status(409).json({ ok:false, error:'email ya existe' });

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await Usuario.create({ nombre: value.nombre, email: value.email, passwordHash });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn:'7d' });
    res.status(201).json({ ok:true, token, user:{ id:user._id, nombre:user.nombre, email:user.email } });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ ok:false, error: error.message });

    const user = await Usuario.findOne({ email: value.email });
    if (!user || !user.passwordHash) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const ok = await bcrypt.compare(value.password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok:false, error:'credenciales inválidas' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn:'7d' });
    res.json({ ok:true, token, user:{ id:user._id, nombre:user.nombre, email:user.email } });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

app.get('/api/me', auth, async (req, res) => {
  const user = await Usuario.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ ok:false, error:'no encontrado' });
  res.json({ ok:true, user:{ id:user._id, nombre:user.nombre, email:user.email } });
});

// ===== Usuarios (CRUD) =====
// Listar
app.get('/api/usuarios', async (_req, res) => {
  try {
    const usuarios = await Usuario.find().sort({ createdAt: -1 }).lean();
    res.json(usuarios);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Crear (simple, sin auth por ahora)
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre || !email) return res.status(400).json({ ok: false, error: 'nombre y email son requeridos' });

    const exists = await Usuario.findOne({ email });
    if (exists) return res.status(409).json({ ok: false, error: 'email ya existe' });

    const u = await Usuario.create({ nombre, email });
    res.status(201).json({ ok: true, usuario: u });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Obtener por id
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const u = await Usuario.findById(req.params.id).lean();
    if (!u) return res.status(404).json({ ok: false, error: 'no encontrado' });
    res.json({ ok: true, usuario: u });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'id inválido' });
  }
});

// Actualizar (nombre/email)
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const { nombre, email } = req.body;
    if (!nombre && !email) return res.status(400).json({ ok: false, error: 'nada para actualizar' });

    if (email) {
      const dup = await Usuario.findOne({ email, _id: { $ne: req.params.id } });
      if (dup) return res.status(409).json({ ok: false, error: 'email ya existe' });
    }

    const u = await Usuario.findByIdAndUpdate(
      req.params.id,
      { ...(nombre && { nombre }), ...(email && { email }) },
      { new: true, runValidators: true }
    );
    if (!u) return res.status(404).json({ ok: false, error: 'no encontrado' });
    res.json({ ok: true, usuario: u });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Borrar
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const u = await Usuario.findByIdAndDelete(req.params.id);
    if (!u) return res.status(404).json({ ok: false, error: 'no encontrado' });
    res.json({ ok: true, eliminado: u._id });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'id inválido' });
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

// ===== Arranque server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

// ===== Cierre elegante =====
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
