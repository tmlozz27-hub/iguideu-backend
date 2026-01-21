// scripts/seed-guides-robusto.mjs
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

function readEnvMongoUri() {
  // lee .env SIEMPRE desde la raíz del proyecto (2 niveles arriba de /scripts)
  const projectRoot = path.resolve(process.cwd());
  const envPath = path.join(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    throw new Error(`No existe .env en: ${envPath}`);
  }

  const txt = fs.readFileSync(envPath, "utf8");
  const line = txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^MONGO_URI\s*=/.test(l));

  if (!line) throw new Error(`No hay MONGO_URI en ${envPath}`);

  const uri = line.split("=").slice(1).join("=").trim();
  if (!uri || uri === '""' || uri === "''") throw new Error("MONGO_URI está vacío");
  return uri;
}

function getGuideModel() {
  // Reutiliza si ya existe
  if (mongoose.models?.Guide) return mongoose.models.Guide;

  const GuideSchema = new mongoose.Schema(
    {
      name: { type: String, required: true },
      country: { type: String, required: true },
      city: { type: String, required: true },
      languages: { type: [String], default: [] },
      pricePerHour: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
      active: { type: Boolean, default: true },
    },
    { timestamps: true }
  );

  return mongoose.model("Guide", GuideSchema);
}

async function run() {
  const uri = readEnvMongoUri();
  console.log("ENV OK -> MONGO_URI loaded (hidden)");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const dbName = mongoose.connection?.name || "connected";
  console.log("MongoDB OK -> dbName=" + dbName);

  const Guide = getGuideModel();

  const seed = [
    {
      name: "Sofía Ramírez",
      country: "Argentina",
      city: "Buenos Aires",
      languages: ["Spanish", "English"],
      pricePerHour: 25,
      rating: 4.8,
      active: true,
    },
    {
      name: "Arun Shrestha",
      country: "Nepal",
      city: "Kathmandu",
      languages: ["English", "Nepali", "Hindi"],
      pricePerHour: 18,
      rating: 4.7,
      active: true,
    },
    {
      name: "Niran Phan",
      country: "Thailand",
      city: "Bangkok",
      languages: ["Thai", "English"],
      pricePerHour: 20,
      rating: 4.6,
      active: true,
    },
  ];

  // upsert por (name+city+country)
  let inserted = 0;
  for (const g of seed) {
    const exists = await Guide.findOne({ name: g.name, city: g.city, country: g.country });
    if (!exists) {
      await Guide.create(g);
      inserted++;
    }
  }

  const total = await Guide.countDocuments();
  console.log(`SEED OK -> inserted=${inserted} totalGuides=${total}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error("SEED ERROR:", e?.message || e);
  process.exit(1);
});
