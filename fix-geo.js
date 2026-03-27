import mongoose from "mongoose";
import "dotenv/config";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.db;
  const col = db.collection("guides");

  const result = await col.updateMany(
    {},
    {
      $set: {
        location: {
          lat: -34.6037,
          lng: -58.3816
        }
      }
    }
  );

  console.log("MODIFICADOS:", result.modifiedCount);
  process.exit();
}

run();