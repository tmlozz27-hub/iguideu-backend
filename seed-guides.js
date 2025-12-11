// seed-guides.js
// Inserta 3 guías base en la misma DB que usa el backend (MONGODB_DB_NAME)

import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// --------------------------------------------------
// Obtener MONGO_URI
// 1) Primero desde process.env.MONGO_URI
// 2) Si no está, intenta leer Desktop\mongo_uri_render.txt
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let MONGO_URI = process.env.MONGO_URI || "";

if (!MONGO_URI) {
  const fallbackPath = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    "Desktop",
    "mongo_uri_render.txt"
  );
  if (fs.existsSync(fallbackPath)) {
    MONGO_URI = fs.readFileSync(fallbackPath, "utf8").trim();
    console.log("📄 MONGO_URI leído desde mongo_uri_render.txt");
  }
}

if (!MONGO_URI) {
  console.error("❌ No se encontró MONGO_URI ni en .env ni en mongo_uri_render.txt");
  process.exit(1);
}

const DB_NAME = process.env.MONGODB_DB_NAME || "iguideu20";
console.log("🔧 Usando MONGO_URI prefix:", MONGO_URI.slice(0, 40) + "...");
console.log("🔧 Usando DB_NAME:", DB_NAME);

// --------------------------------------------------
// Schema igual al del server.js
// --------------------------------------------------
const GuideSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    city: String,
    country: String,
    rating: Number,
    priceHour: Number,
    priceDay: Number,
    // extra: dejamos también estos por compatibilidad futura
    hourlyRate: Number,
    dailyRate: Number,
  },
  { timestamps: true }
);

const Guide = mongoose.model("Guide", GuideSchema);

// --------------------------------------------------
// Datos de prueba
// --------------------------------------------------
const guidesData = [
  {
    id: "arun-bangkok",
    name: "Arun – Bangkok Local Guide",
    city: "Bangkok",
    country: "Thailand",
    rating: 4.8,
    priceHour: 18,
    priceDay: 110,
    hourlyRate: 18,
    dailyRate: 110,
  },
  {
    id: "maya-kathmandu",
    name: "Maya – Kathmandu Cultural Guide",
    city: "Kathmandu",
    country: "Nepal",
    rating: 5,
    priceHour: 15,
    priceDay: 95,
    hourlyRate: 15,
    dailyRate: 95,
  },
  {
    id: "sofia-buenos-aires",
    name: "Sofia – Experta en Buenos Aires",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.9,
    priceHour: 20,
    priceDay: 120,
    hourlyRate: 20,
    dailyRate: 120,
  },
];

async function run() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log("✅ Conectado a Mongo para seed en DB:", DB_NAME);

    // Borramos los guides anteriores
    const deleted = await Guide.deleteMany({});
    console.log(`🧹 Guides borrados: ${deleted.deletedCount}`);

    // Insertamos los nuevos
    const inserted = await Guide.insertMany(guidesData);
    console.log(`✅ Guides insertados: ${inserted.length}`);

    inserted.forEach((g) => {
      console.log(
        `   - ${g.name} (${g.city}) – $${g.priceHour}/h – $${g.priceDay}/día – _id=${g._id.toString()}`
      );
    });

    await mongoose.disconnect();
    console.log("🔌 Desconectado de Mongo. Seed completo.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en seed-guides:", err);
    console.error(err);
    process.exit(1);
  }
}

run();


