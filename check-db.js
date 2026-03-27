import mongoose from "mongoose";
import "dotenv/config";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.db;
  const col = db.collection("guides");

  const total = await col.countDocuments();
  const withLocation = await col.countDocuments({ "location.lat": { $exists: true }, "location.lng": { $exists: true } });

  console.log("DB_NAME_REAL:", db.databaseName);
  console.log("GUIDES_TOTAL:", total);
  console.log("GUIDES_CON_LOCATION:", withLocation);

  process.exit();
}

run();