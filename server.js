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
  });
});

// Demo temporal (mock) hasta conectar DB real
app.get('/api/usuarios', (_req, res) => {
  res.json([
    { id: 1, nombre: 'Usuario Demo 1' },
    { id: 2, nombre: 'Usuario Demo 2' },
  ]);
});

// Arrancar servidor SIEMPRE
const PORT = process.env.PORT || 3000;
// Importante: bind a 0.0.0.0 para Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

// Conectar a Mongo SOLO si hay URI válida y no apunta a localhost
const uri = process.env.MONGODB_URI;
if (uri && !/localhost|127\.0\.0\.1/.test(uri)) {
  mongoose
    .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB conectado'))
    .catch((error) => console.error('Error al conectar MongoDB:', error));
} else {
  console.log('Sin MONGODB_URI válida (o es localhost). Saltando conexión a MongoDB.');
}

// Cierre elegante
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
