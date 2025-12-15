// seed-guides-prod-once.js
// Sembrar guías directamente en la misma DB que usa Render (iguideu20)

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME =
  process.env.DB_NAME || process.env.MONGODB_DB_NAME || "iguideu20";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI no definido en .env");
  process.exit(1);
}

console.log("🌐 MONGO_URI prefix:", MONGO_URI.slice(0, 40));
console.log("🗄️  DB_NAME:", DB_NAME);

// Schema igual que en server.js
const guideSchema = new mongoose.Schema(
  {
    name: String,
    city: String,
    country: String,
    hourlyRateUsd: Number,
    dayRateUsd: Number,
    fullDay24hRateUsd: Number,
    languages: [String],
    rating: Number,
    description: String,
  },
  { timestamps: true }
);

const Guide =
  mongoose.models.Guide || mongoose.model("Guide", guideSchema);

async function runSeed() {
  try {
    console.log("🚀 Conectando a Mongo para seed producción...");
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log("✅ Conectado a Mongo → DB:", DB_NAME);

    const deleted = await Guide.deleteMany({});
    console.log("🧹 Guías borradas:", deleted.deletedCount);

    const guides = await Guide.insertMany([
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRateUsd: 18,
        dayRateUsd: 110,
        fullDay24hRateUsd: 180,
        languages: ["English", "Thai"],
        rating: 4.8,
        description:
          "Experiencias locales en templos, mercados y vida nocturna.",
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRateUsd: 15,
        dayRateUsd: 95,
        fullDay24hRateUsd: 160,
        languages: ["English", "Nepali"],
        rating: 5.0,
        description:
          "Cultura, templos y recorridos locales en Katmandú.",
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRateUsd: 20,
        dayRateUsd: 120,
        fullDay24hRateUsd: 200,
        languages: ["Spanish", "English"],
        rating: 4.9,
        description:
          "Historia, cultura y gastronomía porteña.",
      },
    ]);

    console.log("✅ Guías insertadas:", guides.length);
    guides.forEach((g) =>
      console.log(`   - ${g.name} (${g.city}) – _id=${g._id}`)
    );
  } catch (err) {
    console.error("❌ Error en seed producción:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado de Mongo. Fin seed.");
    process.exit(0);
  }
}

runSeed();
