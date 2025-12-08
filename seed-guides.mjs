import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const Guide = mongoose.model(
  "Guide",
  new mongoose.Schema({
    name: String,
    city: String,
    country: String,
    hourlyRate: Number,
    dailyRate: Number,
    rating: Number,
    languages: [String],
    description: String,
  })
);

async function run() {
  try {
    console.log("Conectando a Mongo...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("OK conectado.");

    const guides = [
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRate: 18,
        dailyRate: 110,
        rating: 4.8,
        languages: ["English", "Thai"],
        description: "Templos · Street food · Mercados nocturnos",
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        rating: 5.0,
        languages: ["English", "Nepali"],
        description: "Durbar Square, Boudhanath y experiencia local",
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        rating: 4.9,
        languages: ["Spanish", "English"],
        description: "Recorridos históricos y culturales",
      }
    ];

    await Guide.deleteMany({});
    await Guide.insertMany(guides);

    console.log("✔️ Guías insertados correctamente.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
