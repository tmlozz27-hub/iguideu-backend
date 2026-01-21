import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "";
const COLLECTION = process.env.BOOKINGS_COLLECTION || "bookings";

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(
    d.getSeconds()
  )}`;
}

async function main() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI missing");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME || undefined });
  console.log(`✅ Mongo conectado (db=${mongoose.connection?.name || DB_NAME || "unknown"})`);

  const col = mongoose.connection.db.collection(COLLECTION);

  // Criterio de basura: reservas viejas creadas cuando no se resolvía el guide
  const filter = {
    $or: [{ guideName: "Unknown Guide" }, { totalUsd: 0 }],
  };

  const docs = await col.find(filter).toArray();
  console.log(`Encontradas para limpiar: ${docs.length}`);

  if (docs.length === 0) {
    console.log("Nada que limpiar ✅");
    await mongoose.disconnect();
    process.exit(0);
  }

  // Backup antes de borrar (seguro)
  const backupPath = path.join(process.cwd(), "scripts", `_backup_unknown_bookings_${ts()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2), "utf8");
  console.log(`📦 Backup creado: ${backupPath}`);

  const del = await col.deleteMany(filter);
  console.log(`🧹 DeleteMany OK: deleted=${del.deletedCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ cleanup error:", e?.message || e);
  process.exit(1);
});
