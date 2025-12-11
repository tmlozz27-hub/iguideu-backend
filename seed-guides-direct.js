// seed-guides-direct.js
// ⚠️ NO subir este archivo a GitHub con credenciales reales.
// Úsalo solo en tu PC local para sembrar la DB de producción.

import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "iguideu20";

if (!uri) {
  console.error("❌ Falta MONGO_URI en las variables de entorno");
  process.exit(1);
}

console.log("🔧 Conectando a Mongo URI (prefix):", uri.slice(0, 40) + "...");
console.log("🔧 Usando DB_NAME:", dbName);

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const guides = db.collection("guides");

    console.log("🧹 Borrando guides anteriores...");
    const delResult = await guides.deleteMany({});
    console.log("🧹 Guides borrados:", delResult.deletedCount);

    const docs = [
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyPriceUsd: 18,
        dailyPriceUsd: 110,
        rating: 4.8,
        languages: ["English", "Thai"],
        shortDescription: "Templos · Street food · Mercados nocturnos",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyPriceUsd: 15,
        dailyPriceUsd: 95,
        rating: 5.0,
        languages: ["English", "Nepali"],
        shortDescription: "Durbar Square, Boudhanath y experiencia local en el valle.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyPriceUsd: 20,
        dailyPriceUsd: 120,
        rating: 4.9,
        languages: ["Spanish", "English"],
        shortDescription: "Recorridos históricos y culturales por Buenos Aires.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    console.log("🌱 Insertando guides demo...");
    const insResult = await guides.insertMany(docs);
    console.log("✅ Guides insertados:", insResult.insertedCount);
    console.log("🆔 IDs:", insResult.insertedIds);

  } catch (err) {
    console.error("❌ Error en seed:", err);
  } finally {
    await client.close();
    console.log("🔚 Conexión cerrada.");
  }
}

run();
