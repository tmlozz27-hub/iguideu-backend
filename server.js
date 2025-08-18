// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas básicas
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

app.get('/api/usuarios', (_req, res) => {
  res.json([
    { id: 1, nombre: 'Usuario Demo 1' },
    { id: 2, nombre: 'Usuario Demo 2' },
  ]);
});

// 🚀 Nueva ruta de test de DB
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

// Arrancar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

// Conexión Mongo
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose
    .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ MongoDB conectado'))
    .catch((error) => console.error('❌ Error al conectar MongoDB:', error));
} else {
  console.log('⚠️ Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

// Cierre elegante
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
