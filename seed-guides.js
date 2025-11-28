// seed-guides.js - agrega Maya y Sofia a la colección "guides"

require("dotenv").config();
const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI;
console.log("MONGO_URI:", mongoUri ? "SET" : "MISSING");

const guideSchema = new mongoose.Schema(
  {
    guideId: { type: String, index: true },
    code: String,
    name: String,
    city: String,
    country: String,
    hourlyRate: Number,
    dailyRate: Number,
    rating: Number,
    languages: [String],
    description: String,
    photo: String
  },
  { timestamps: true }
);

const Guide = mongoose.model("Guide", guideSchema, "guides");

async function seed() {
  try {
    await mongoose.connect(mongoUri || "", {});
    console.log("✅ Conectado a MongoDB");

    const guides = [
      {
        guideId: "g1002",
        code: "g1002",
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        rating: 5.0,
        languages: ["English", "Nepali"],
        description:
          "Durbar Square, Boudhanath y experiencia local en el valle.",
        photo: "https://images.iguideu-demo.com/maya-kathmandu.jpg"
      },
      {
        guideId: "g1003",
        code: "g1003",
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        rating: 4.9,
        languages: ["Spanish", "English"],
        description:
          "Recorridos históricos y culturales por Buenos Aires.",
        photo: "https://images.iguideu-demo.com/sofia-buenosaires.jpg"
      }
    ];

    await Guide.insertMany(guides);
    console.log("✨ Guías Maya y Sofia agregadas correctamente.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en seed:", err);
    process.exit(1);
  }
}

seed();

