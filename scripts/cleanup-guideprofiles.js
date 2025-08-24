// scripts/cleanup-guideprofiles.js
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGO_URI en .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('guideprofiles');

  // borra documentos inválidos con userId null o undefined
  const res = await col.deleteMany({ $or: [ { userId: null }, { userId: { $exists: false } } ] });
  console.log('Eliminados docs inválidos:', res.deletedCount);

  // (opcional) asegurar índice único correcto (ya existe en tu caso)
  // await col.dropIndexes();
  // await col.createIndex({ userId: 1 }, { unique: true });

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
