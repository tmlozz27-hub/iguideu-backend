// server.js — mínimo y estable
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health simple para verificar que está vivo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// (Opcional) Carga de rutas de bookings; si falla NO detiene el server
try {
  const bookingRoutes = require('./src/routes/booking.routes');
  app.use('/api', bookingRoutes);
} catch (e) {
  console.error('WARN cargando booking.routes:', e.message);
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
