import "dotenv/config";
import { connectMongo, getModels } from "../src/services/mongo.js";

async function run() {
  await connectMongo();
  const { Guide } = getModels();

  const sample = [
    {
      name: "Luna García",
      country: "Argentina",
      city: "Buenos Aires",
      languages: ["Español", "English"],
      pricePerHour: 25,
      rating: 4.8,
      active: true,
      bio: "Guía local en BA: cultura, comida, historia."
    },
    {
      name: "Nikhil Sharma",
      country: "India",
      city: "Delhi",
      languages: ["English", "Hindi"],
      pricePerHour: 18,
      rating: 4.6,
      active: true,
      bio: "City tours, street food y templos."
    },
    {
      name: "Suda P.",
      country: "Thailand",
      city: "Bangkok",
      languages: ["Thai", "English"],
      pricePerHour: 22,
      rating: 4.7,
      active: true,
      bio: "Bangkok highlights + floating market."
    }
  ];

  const inserted = [];
  for (const g of sample) {
    const exists = await Guide.findOne({ name: g.name, city: g.city }).lean();
    if (!exists) {
      const doc = await Guide.create(g);
      inserted.push(doc?._id?.toString());
    }
  }

  const total = await Guide.countDocuments();
  console.log("✅ SEED OK -> inserted:", inserted.length, "totalGuides:", total);

  process.exit(0);
}

run().catch((e) => {
  console.error("❌ SEED ERROR:", e?.message || e);
  process.exit(1);
});
