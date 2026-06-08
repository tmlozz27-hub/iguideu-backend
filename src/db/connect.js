import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGO_URI no definido');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  logger.info('MongoDB conectado');
}
