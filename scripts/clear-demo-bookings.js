import "dotenv/config";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Falta MONGO_URI en .env");
  process.exit(1);
}

async function run() {
  try {
    console.log("Conectando a MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("Borrando TODAS las reservas (demo)...");
    const result = await Booking.deleteMany({});
    console.log(`✅ Reservas eliminadas: ${result.deletedCount}`);

  } catch (err) {
    console.error("❌ Error limpiando reservas:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Conexión cerrada.");
    process.exit(0);
  }
}

run();
