// scripts/seed-guides-direct.mjs
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

const GUIDES = [
  {
    name: "Somchai",
    city: "Bangkok",
    country: "Thailand",
    rating: 4.8,
    languages: ["EN", "TH"],
  },
  {
    name: "Maya",
    city: "Kathmandu",
    country: "Nepal",
    rating: 4.9,
    languages: ["EN", "NE"],
  },
  {
    name: "Sofía",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.7,
    languages: ["ES", "EN"],
  },
];

async function main() {
  console.log("Connecting to Mongo...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const db = mongoose.connection.db;
  const col = db.collection("guides");

  const count = await col.countDocuments();
  console.log("guides count =", count);

  if (count === 0) {
    const now = new Date();
    const docs = GUIDES.map((g) => ({
      ...g,
      createdAt: now,
      updatedAt: now,
      status: "ACTIVE",
    }));

    const r = await col.insertMany(docs, { ordered: true });
    console.log("Inserted guides:", Object.keys(r.insertedIds).length);
  } else {
    console.log("No inserto nada: ya hay guías en la colección.");
  }

  await mongoose.disconnect();
  console.log("DONE");
}

main().catch(async (e) => {
  console.error("SEED ERROR:", e?.message || e);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
