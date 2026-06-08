import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    hasMongoUri: Boolean(process.env.MONGO_URI),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

export default router;
