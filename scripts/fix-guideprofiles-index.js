require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGO_URI en .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: undefined });
  const db = mongoose.connection.db;
  const col = db.collection('guideprofiles');

  console.log('📦 Colección:', col.namespace);

  // 1) Mostrar índices actuales
  const before = await col.indexes();
  console.log('Índices ANTES:\n', before);

  // 2) Migrar campo viejo `user` -> `userId` si existiera
  const withUser = await col.countDocuments({ user: { $exists: true } });
  if (withUser > 0) {
    console.log(`🔁 Migrando ${withUser} docs: user -> userId`);
    // pipeline de actualización (requiere MongoDB 4.2+)
    await col.updateMany(
      { user: { $exists: true } },
      [
        { $set: { userId: '$user' } },
        { $unset: 'user' }
      ]
    );
  }

  // 3) Borrar docs inválidos (userId null o faltante)
  const toDelete = await col.countDocuments({ $or: [{ userId: null }, { userId: { $exists: false } }] });
  if (toDelete > 0) {
    console.log(`🧹 Eliminando ${toDelete} docs inválidos (userId null/faltante)`);
    await col.deleteMany({ $or: [{ userId: null }, { userId: { $exists: false } }] });
  }

  // 4) Dropear índices viejos problemáticos
  const dropIfExists = async (name) => {
    try {
      await col.dropIndex(name);
      console.log(`🗑️  Drop index ${name}`);
    } catch (e) {
      if (e.codeName === 'IndexNotFound' || /not found/i.test(e.message)) {
        console.log(`(ok) Índice ${name} no existe`);
      } else {
        console.log(`Aviso al dropear ${name}:`, e.message);
      }
    }
  };

  await dropIfExists('user_1');
  await dropIfExists('userId_1'); // lo recreamos limpio abajo

  // 5) Crear índice correcto (único con filtro parcial)
  try {
    await col.createIndex(
      { userId: 1 },
      {
        unique: true,
        name: 'userId_1',
        partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } }
      }
    );
    console.log('✅ Índice userId_1 creado (unique + partial)');
  } catch (e) {
    console.error('Error creando índice userId_1:', e);
  }

  const after = await col.indexes();
  console.log('Índices DESPUÉS:\n', after);

  await mongoose.disconnect();
  console.log('✔️ Listo.');
  process.exit(0);
})().catch(async (e) => {
  console.error('Fallo script:', e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
