// scripts/copy-guides-collection.mjs
import "dotenv/config";
import mongoose from "mongoose";

const uri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

if (!uri) {
  console.error("ERROR: No encuentro MONGO_URI / MONGODB_URI en .env");
  process.exit(1);
}

// CAMBIAR SOLO ESTO cuando sepamos el nombre real:
const FROM = "guides";      // donde viste "count = 9"
const TO = "tourGuides";    // <-- EJEMPLO. lo reemplazamos por el que diga inspect.

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  console.log("DB:", db.databaseName);
  console.log("Copy FROM:", FROM, "TO:", TO);

  const from = db.collection(FROM);
  const to = db.collection(TO);

  const srcCount = await from.countDocuments();
  console.log("FROM count:", srcCount);

  if (srcCount === 0) {
    console.log("Nothing to copy.");
    await mongoose.disconnect();
    return;
  }

  const docs = await from.find({}).toArray();

  // limpiar _id para que Mongo asigne nuevos
  const cleaned = docs.map(({ _id, ...rest }) => ({
    ...rest,
    updatedAt: new Date(),
  }));

  // insertMany
  const r = await to.insertMany(cleaned, { ordered: false });
  console.log("Inserted into TO:", Object.keys(r.insertedIds).length);

  const toCount = await to.countDocuments();
  console.log("TO count now:", toCount);

  await mongoose.disconnect();
  console.log("DONE");
}

main().catch(async (e) => {
  console.error("COPY ERROR:", e?.message || e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
