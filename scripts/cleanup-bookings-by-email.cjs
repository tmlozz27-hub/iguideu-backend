/**
 * Limpia bookings por travelerEmail (seguro):
 * - Conecta a Mongo usando MONGO_URI (dotenv)
 * - Hace BACKUP de los docs que va a borrar
 * - Borra de la colección "bookings" por travelerEmail
 *
 * Uso:
 *   node .\scripts\cleanup-bookings-by-email.js test+frontend@iguideu.com
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const email = process.argv[2];

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

(async () => {
  try {
    if (!email) {
      console.log("❌ Falta email. Ej: node .\\scripts\\cleanup-bookings-by-email.js test+frontend@iguideu.com");
      process.exit(1);
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.log("❌ Falta MONGO_URI en .env");
      process.exit(1);
    }

    const client = new MongoClient(mongoUri, { ignoreUndefined: true });
    await client.connect();

    // Intentamos tomar dbName del URI; si no, usamos el db actual del cliente
    const uriDbName = (() => {
      try {
        const u = new URL(mongoUri.replace("mongodb+srv://", "https://").replace("mongodb://", "https://"));
        const p = u.pathname?.replace("/", "");
        return p || null;
      } catch {
        return null;
      }
    })();

    const db = client.db(uriDbName || undefined);

    // Colección
    const col = db.collection("bookings");

    const filter = { travelerEmail: email };

    const count = await col.countDocuments(filter);
    console.log(`✅ Mongo conectado (db=${db.databaseName})`);
    console.log(`🔎 Bookings para limpiar (travelerEmail=${email}): ${count}`);

    if (count === 0) {
      console.log("✅ Nada para borrar. Listo.");
      await client.close();
      process.exit(0);
    }

    const docs = await col.find(filter).toArray();

    const backupName = `_backup_bookings_email_${email.replace(/[^a-z0-9@._+-]/gi, "_")}_${nowStamp()}.json`;
    const backupPath = path.join(__dirname, backupName);
    fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2), "utf8");
    console.log(`📦 Backup creado: ${backupPath}`);

    const res = await col.deleteMany(filter);
    console.log(`🧹 DeleteMany OK: deleted=${res.deletedCount}`);

    await client.close();
    process.exit(0);
  } catch (err) {
    console.log("❌ ERROR:", err?.message || err);
    process.exit(1);
  }
})();
