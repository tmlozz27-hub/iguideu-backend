require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./src/config/db');

// Rutas
const authRoutes = require('./src/routes/auth.routes');
const healthRoutes = require('./src/routes/health.routes');
const bookingRoutes = require('./src/routes/booking.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const guideRoutes = require('./src/routes/guide.routes');
const availabilityRoutes = require('./src/routes/availability.routes');

const app = express();

// Seguridad / utilidades
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120
});
app.use(limiter);

// Rutas
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/availability', availabilityRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Start
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iguideu';

(async () => {
  await connectDB(mongoUri);
  app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
})();
