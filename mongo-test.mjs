import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
console.log("Probando:", uri.replace(/:[^@]+@/,"://<pwd>@"));
try {
  await mongoose.connect(uri);
  console.log("[TEST] Conectado OK");
  await mongoose.disconnect();
  process.exit(0);
} catch (e) {
  console.error("[TEST] Error:", e.message);
  process.exit(1);
}
