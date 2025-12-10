// seed-guides.js
// Carga guías de prueba en la base de datos de Backend 24

import "dotenv/config";
import mongoose from "mongoose";
import Guide from "./models/Guide.js";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://iguideu23_user:Lorenza2727@iguideu-db.sfgtfz8.mongodb.net/iguideu20?retryWrites=true&w=majority&appName=iguideu-db";

console.log("🔌 Conectando a Mongo para seed de guías...");
console.log("DEBUG MONGO_URI (seed):", MONGO_URI);

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a Mongo (seed)");

    // Opcional: limpiar guías anteriores
    await Guide.deleteMany({});
    console.log("🧹 Colección Guide limpiada.");

    const guides = [
      {
        code: "maya-kathmandu",
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        promo12hRate: 180,   // promo más barata que 95 + 4*15 = 155? (ajustás si querés)
        fullDay24hRate: 190, // full day especial
        rating: 5,
        languages: ["English", "Nepali"],
        description:
          "Recorridos culturales por el Valle de Katmandú, Durbar Square, Boudhanath y vida local.",
        isActive: true,
      },
      {
        code: "sofia-buenosaires",
        name: "Sofía – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        promo12hRate: 220,
        fullDay24hRate: 240,
        rating: 4.9,
        languages: ["Spanish", "English"],
        description:
          "Recorridos históricos y culturales por Buenos Aires, barrios clásicos y secretos locales.",
        isActive: true,
      },
      {
        code: "arun-bangkok",
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Thailand",
        hourlyRate: 18,
        dailyRate: 110,
        promo12hRate: 200,
        fullDay24hRate: 220,
        rating: 4.8,
        languages: ["English", "Thai"],
        description:
          "Templos, street food, mercados nocturnos y experiencia local en Bangkok.",
        isActive: true,
      },
    ];

    const result = await Guide.insertMany(guides);
    console.log(`✅ Guías insertadas: ${result.length}`);
    result.forEach((g) =>
      console.log(`   - ${g.name} (${g._id.toString()})`)
    );
  } catch (err) {
    console.error("❌ Error en seed-guides:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Desconectado de Mongo (seed).");
    process.exit(0);
  }
}

run();
