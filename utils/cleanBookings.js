// utils/cleanBookings.js
// Limpia bookings viejos/rotos de la base para que la lista se vea prolija

import 'dotenv/config';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ No está definida MONGO_URI en .env');
  process.exit(1);
}


async function run() {
  try {
    console.log('🔌 Conectando a MongoDB para limpieza...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB conectado');

    const totalAntes = await Booking.countDocuments();
    console.log(`📊 Total de bookings ANTES: ${totalAntes}`);

    // Criterio de "booking sano":
    // - guideName existe y no está vacío
    // - durationType existe
    // - currentTotalUsd existe
    // - travelerEmail existe
    //
    // Eliminamos TODO lo que NO cumpla eso.
    const filterRotas = {
      $or: [
        { guideName: { $exists: false } },
        { guideName: '' },
        { durationType: { $exists: false } },
        { currentTotalUsd: { $exists: false } },
        { travelerEmail: { $exists: false } }
      ]
    };

    const rotasAntes = await Booking.countDocuments(filterRotas);
    console.log(`🧹 Bookings "rotas" detectadas: ${rotasAntes}`);

    if (rotasAntes === 0) {
      console.log('👍 No hay bookings rotas para borrar.');
    } else {
      const result = await Booking.deleteMany(filterRotas);
      console.log(`🗑️ Eliminadas: ${result.deletedCount} bookings rotas.`);
    }

    const totalDespues = await Booking.countDocuments();
    console.log(`📊 Total de bookings DESPUÉS: ${totalDespues}`);

    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB. Limpieza terminada.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la limpieza:', err);
    process.exit(1);
  }
}

run();
