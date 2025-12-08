import "dotenv/config";
import mongoose from "mongoose";
import Guide from "../models/Guide.js";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Falta MONGO_URI en el archivo .env");
  process.exit(1);
}

async function run() {
  try {
    console.log("Conectando a MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("Borrando guías anteriores...");
    await Guide.deleteMany({});

    const guides = [
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRate: 18,
        dailyRate: 110,
        rating: 4.8,
        languages: ["English", "Thai"],
        description: "Templos, mercados nocturnos y vida local en Bangkok.",
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        rating: 5.0,
        languages: ["English", "Nepali"],
        description: "Durbar Square, Boudhanath y experiencia local en el valle.",
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        rating: 4.9,
        languages: ["Spanish", "English"],
        description: "Recorridos históricos y culturales por Buenos Aires.",
      },
    ];

    console.log("Insertando guías...");
    const result = await Guide.insertMany(guides);
    console.log(`✅ Cargadas ${result.length} guías.`);
  } catch (err) {
    console.error("❌ Error sembrando guías:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Conexión cerrada.");
    process.exit(0);
  }
}

run();
