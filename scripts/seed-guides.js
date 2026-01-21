// scripts/seed-guides.js  (PEGAR ENTERO)
// Seed de guías: carga .env y hace upsert sin conflicto en gid.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ .env cargado:", envPath);
} else {
  dotenv.config();
  console.log("⚠️ No encontré .env en", envPath, "(usé dotenv default)");
}

function pickEnv(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

const MONGO_URI = pickEnv("MONGO_URI", "MONGODB_URI", "DATABASE_URL");
const DB_NAME = pickEnv("MONGODB_DB_NAME", "DB_NAME", "MONGO_DBNAME");

if (!MONGO_URI) {
  console.error("❌ MONGO_URI vacío/no cargado. Revisá .env");
  process.exit(1);
}

const now = () => new Date();

const demo = [
  {
    gid: "g-001",
    name: "Guía 1",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.8,
    languages: ["ES", "EN"],
    priceHour: 25,
    priceDay: 160,
    price24h: 280,
    bio: "Guía local con experiencia en tours personalizados.",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    gid: "g-002",
    name: "Guía 2",
    city: "Bangkok",
    country: "Thailand",
    rating: 4.6,
    languages: ["EN"],
    priceHour: 22,
    priceDay: 150,
    price24h: 260,
    bio: "City tours, street food y cultura.",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    gid: "g-003",
    name: "Guía 3",
    city: "Kathmandu",
    country: "Nepal",
    rating: 4.9,
    languages: ["ES", "EN"],
    priceHour: 18,
    priceDay: 120,
    price24h: 210,
    bio: "Templos, trekking y experiencias auténticas.",
    active: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

// helper: arma $set sin gid
function withoutGid(obj) {
  const { gid, ...rest } = obj;
  return rest;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  const db = DB_NAME ? client.db(DB_NAME) : client.db();
  const col = db.collection("guides");

  let upserts = 0;
  for (const g of demo) {
    const res = await col.updateOne(
      { gid: g.gid },
      {
        $set: withoutGid(g),         // ✅ NO incluye gid
        $setOnInsert: { gid: g.gid } // ✅ gid solo acá
      },
      { upsert: true }
    );
    if (res.upsertedCount || res.modifiedCount) upserts++;
  }

  const count = await col.countDocuments({});
  console.log(`✅ Seed OK. Upserts: ${upserts}. Total guides en DB: ${count}`);

  await client.close();
}

main().catch((e) => {
  console.error("❌ Seed ERROR:", e?.message || e);
  process.exit(1);
});
