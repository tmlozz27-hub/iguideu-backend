import mongoose from "mongoose";
import dotenv from "dotenv";
import Guide from "./models/Guide.js";

dotenv.config();

async function seedGuides() {
  try {
    console.log("DEBUG MONGO_URI (seed):", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado a MongoDB (seed)");

    const count = await Guide.countDocuments();
    console.log("Guías actuales en la colección:", count);

    if (count > 0) {
      console.log("Ya hay guías en la base, no hago nada.");
      await mongoose.disconnect();
      return;
    }

    const guides = [
      {
        code: "g1001",
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRate: 18,
        dailyRate: 110,
        rating: 4.8,
        languages: ["English", "Thai"],
        description: "Templos, street food y mercados nocturnos en Bangkok.",
        tags: ["temples", "street food", "night markets"],
      },
      {
        code: "g1002",
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        rating: 5.0,
        languages: ["English", "Nepali"],
        description:
          "Cultura del valle de Katmandú, templos y vida local.",
        tags: ["culture", "temples", "local life"],
      },
      {
        code: "g1003",
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        rating: 4.9,
        languages: ["Spanish", "English"],
        description:
          "Historia, cafés notables y barrios clásicos porteños.",
        tags: ["history", "local life", "culture"],
      },
    ];

    await Guide.insertMany(guides);
    console.log("✅ Guías demo insertadas correctamente.");
    await mongoose.disconnect();
    console.log("🔌 Conexión cerrada (seed).");
  } catch (err) {
    console.error("❌ Error en seed-guides:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedGuides().then(() => process.exit(0));
