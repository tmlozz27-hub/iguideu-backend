const mongoose = require('mongoose');

async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri); // sin opciones legacy ni fallback a localhost
  console.log('✅ MongoDB conectado');
}

module.exports = { connectDB };
