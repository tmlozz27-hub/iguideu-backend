import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ Falta MONGO_URI (o MONGODB_URI) en variables de entorno.");
  process.exit(1);
}

const GuideSchema = new mongoose.Schema(
  {
    id: { type: String, index: true },
    name: String,
    city: String,
    country: String,
    rating: Number,
    hourlyRate: Number,
    dailyRate: Number,

    // compat
    priceHour: Number,
    priceDay: Number,
    pricePerHourUsd: Number,
    pricePerDayUsd: Number,
    languages: [String],
    lat: Number,
    lng: Number,
  },
  { timestamps: true }
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", GuideSchema);

const guides = [
  {
    id: "maya-kathmandu",
    name: "Maya – Kathmandu Cultural Guide",
    city: "Kathmandu",
    country: "Nepal",
    rating: 5,
    hourlyRate: 15,
    dailyRate: 95,
    priceHour: 15,
    priceDay: 95,
  },
  {
    id: "sofia-buenos-aires",
    name: "Sofia – Experta en Buenos Aires",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.9,
    hourlyRate: 20,
    dailyRate: 120,
    priceHour: 20,
    priceDay: 120,
  },
  {
    id: "arun-bangkok",
    name: "Arun – Bangkok Local Guide",
    city: "Bangkok",
    country: "Thailand",
    rating: 4.8,
    hourlyRate: 18,
    dailyRate: 110,
    priceHour: 18,
    priceDay: 110,
  },
];

async function main() {
  console.log("== SEED GUIDES SAFE ==");
  await mongoose.connect(MONGO_URI);
  console.log("Mongo connected.");

  for (const g of guides) {
    const existing = await Guide.findOne({ $or: [{ id: g.id }, { name: g.name }] });
    if (existing) {
      // actualizo para arreglar campos si estaban en 0
      await Guide.updateOne({ _id: existing._id }, { $set: g });
      console.log("✅ Updated:", g.name);
    } else {
      await Guide.create(g);
      console.log("✅ Created:", g.name);
    }
  }

  const count = await Guide.countDocuments();
  console.log("TOTAL GUIDES =>", count);

  await mongoose.disconnect();
  console.log("DONE.");
}

main().catch((e) => {
  console.error("❌ Seed error:", e?.message ?? e);
  process.exit(1);
});
