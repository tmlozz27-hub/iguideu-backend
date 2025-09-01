require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middlewares base
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  });
});

// Rutas
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/bookings', require('./src/routes/booking.routes'));
app.use('/api/policies', require('./src/routes/policy.routes'));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  res
    .status(err.status || 500)
    .json({ error: err.code || 'internal_error', message: err.message || 'Unexpected error' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Express vivo en ${HOST}:${PORT}`);
});
