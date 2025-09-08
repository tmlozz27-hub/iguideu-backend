import "dotenv/config";
import mongoose from "mongoose";
import Booking from "./src/models/Booking.js";

const guideCode = process.argv[2] || "g1001";

(async () => {
  try {
    if(!process.env.MONGO_URI){ console.error("MONGO_URI no configurada"); process.exit(1); }
    await mongoose.connect(process.env.MONGO_URI);
    const q = { guide: guideCode };
    const { deletedCount } = await Booking.deleteMany(q);
    console.log(`[CLEAN] Eliminadas ${deletedCount} reservas de ${guideCode}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
