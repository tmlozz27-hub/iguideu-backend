// scripts/inspect-guides.mjs
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

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  console.log("DB:", db.databaseName);

  const cols = await db.listCollections().toArray();
  const names = cols.map((c) => c.name).sort();
  console.log("Collections:", names.join(", "));

  // mostrar conteos de colecciones candidatas
  const candidates = names.filter((n) =>
    /guide/i.test(n)
  );

  console.log("\nCandidate collections (name includes 'guide'):");
  for (const n of candidates) {
    const c = db.collection(n);
    const count = await c.countDocuments();
    console.log(`- ${n}: ${count}`);
  }

  // mostrar un ejemplo del contenido de cada candidata (primer doc)
  console.log("\nSample doc of each candidate (first doc):");
  for (const n of candidates) {
    const c = db.collection(n);
    const doc = await c.findOne({});
    console.log(`\n--- ${n} ---`);
    console.log(doc ? JSON.stringify(doc, null, 2) : "EMPTY");
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("INSPECT ERROR:", e?.message || e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
