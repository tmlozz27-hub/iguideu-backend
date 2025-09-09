import paymentsRoutes from './src/routes/payments.routes.js';
import bookingsRoutes from './src/routes/bookings.routes.js';
import guidesRoutes   from './src/routes/guides.routes.js';
import authRoutes     from './src/routes/auth.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/guides', guidesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);   // <- clave para evitar "Cannot POST /api/payments/..."
