// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== Helpers =====
function mongoStateLabel(state) {
  return ["disconnected","connected","connecting","disconnecting"][state] ?? "unknown";
}

// ===== Modelo Usuario (inline para simplificar) =====
const usuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 2 },
    email:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

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

// ===== Usuarios reales (Mongo) =====
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

// Cierre elegante (opcional)
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
