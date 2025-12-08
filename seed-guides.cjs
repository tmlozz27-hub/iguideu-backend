const mongoose = require("mongoose");
require("dotenv").config();

const Guide = require("./models/Guide.js");

async function seed() {
  try {
    console.log("Conectando a Mongo...");
    await mongoose.connect(process.env.MONGO_URI);

    const guides = [
      {
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        hourlyRate: 18,
        dailyRate: 110,
        languages: ["English", "Thai"],
        description: "Templos · Street food · Mercados nocturnos",
      },
      {
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        hourlyRate: 15,
        dailyRate: 95,
        languages: ["English", "Nepali"],
        description: "Durbar Square, Boudhanath y experiencia local",
      },
      {
        name: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        hourlyRate: 20,
        dailyRate: 120,
        languages: ["Spanish", "English"],
        description: "Historia · Cultura · Recorridos locales",
      },
    ];

    await Guide.deleteMany({});
    await Guide.insertMany(guides);

    console.log("Seedeo completo 👌");
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}

seed();
