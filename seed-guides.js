// seed-guides.js (ESM)
import "dotenv/config";
import mongoose from "mongoose";
import Guide from "./models/Guide.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || undefined;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI / MONGODB_URI");
  process.exit(1);
}

const guides = [
  { id: "arun-bangkok", name: "Arun – Bangkok Local Guide", city: "Bangkok", country: "Thailand" },
  { id: "maya-kathmandu", name: "Maya – Kathmandu Cultural Guide", city: "Kathmandu", country: "Nepal" },
  { id: "sofia-buenosaires", name: "Sofia – Experta en Buenos Aires", city: "Buenos Aires", country: "Argentina" },
];

async function main() {
  await mongoose.connect(MONGO_URI, DB_NAME ? { dbName: DB_NAME } : {});
  const existing = await Guide.find({ id: { $in: guides.map(g => g.id) } }).lean();
  const existingIds = new Set(existing.map(x => x.id));
  const toInsert = guides.filter(g => !existingIds.has(g.id));

  if (toInsert.length) {
    await Guide.insertMany(toInsert);
    console.log("Inserted guides:", toInsert.map(g => g.id));
  } else {
    console.log("Guides already exist. Nothing inserted.");
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

