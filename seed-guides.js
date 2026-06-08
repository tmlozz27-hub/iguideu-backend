import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "iguideu";

if (!MONGO_URI) {
  console.error("❌ Falta MONGO_URI en .env");
  process.exit(1);
}

const guides = [
  {
    code: "ARUN-BKK",
    name: "Arun",
    title: "Bangkok Local Guide",
    city: "Bangkok",
    country: "Thailand",
    rating: 4.8,
    priceHourUsd: 18,
    priceDayUsd: 110,
    languages: ["English", "Thai"],
    tags: ["Food", "Temples", "Culture"],
    photoUrl: "https://images.unsplash.com/photo-1549692520-acc6669e2f0c"
  },
  {
    code: "MAYA-KTM",
    name: "Maya",
    title: "Kathmandu Cultural Guide",
    city: "Kathmandu",
    country: "Nepal",
    rating: 4.7,
    priceHourUsd: 15,
    priceDayUsd: 95,
    languages: ["English", "Nepali"],
    tags: ["Culture", "Heritage", "Walking Tour"],
    photoUrl: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da"
  },
  {
    code: "SOFIA-BUE",
    name: "Sofia",
    title: "Experta en Buenos Aires",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.9,
    priceHourUsd: 20,
    priceDayUsd: 120,
    languages: ["Spanish", "English"],
    tags: ["City Tour", "Food", "Nightlife"],
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"
  }
];

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const col = db.collection("guides");

  const del = await col.deleteMany({});
  console.log(`🧹 Guides borrados: ${del.deletedCount}`);

  const ins = await col.insertMany(guides, { ordered: true });
  console.log(`✅ Guides insertados: ${ins.insertedCount}`);

  await client.close();
  process.exit(0);
})().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
