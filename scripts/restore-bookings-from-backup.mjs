// scripts/restore-bookings-from-backup.mjs
// Restaura bookings demo desde un backup JSON (sin duplicar por _id).
// Uso: node scripts/restore-bookings-from-backup.mjs scripts\_backup_unknown_bookings_20260106_204151.json

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const fileArg = process.argv[2];
if (!fileArg) {
  console.log("USO: node scripts/restore-bookings-from-backup.mjs <ruta-backup.json>");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath)) {
  console.log("NO EXISTE:", filePath);
  process.exit(1);
}

// Carga .env si existe (tu server ya lo usa)
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch {}

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.log("FALTA MONGO_URI / MONGODB_URI en env/.env");
  process.exit(1);
}

const raw = fs.readFileSync(filePath, "utf8");
const json = JSON.parse(raw);

// Tu backup puede venir como { bookings: [...] } o directamente [...]
const bookings = Array.isArray(json) ? json : (json.bookings || json.data || []);
if (!Array.isArray(bookings)) {
  console.log("Formato de backup no reconocido.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("MongoDB conectado");

let Booking;
try {
  // Intentamos cargar el modelo desde tus rutas comunes
  const mod1 = await import("../src/models/Booking.js");
  Booking = mod1.default || mod1.Booking || mod1;
} catch {
  try {
    const mod2 = await import("../src/models/booking.js");
    Booking = mod2.default || mod2.Booking || mod2;
  } catch {
    console.log("No pude importar el modelo Booking. Revisar ruta src/models/Booking.js");
    process.exit(1);
  }
}

let inserted = 0;
let skipped = 0;

for (const b of bookings) {
  try {
    // Si trae _id, intentamos upsert por _id
    if (b && b._id) {
      const exists = await Booking.findById(b._id).lean();
      if (exists) {
        skipped++;
        continue;
      }
    }
    await Booking.create(b);
    inserted++;
  } catch (e) {
    // Si falla por duplicado u otro detalle, lo contamos como skip
    skipped++;
  }
}

console.log(`DONE inserted=${inserted} skipped=${skipped}`);

await mongoose.disconnect();
process.exit(0);
