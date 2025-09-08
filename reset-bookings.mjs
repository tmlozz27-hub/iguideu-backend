import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
await mongoose.connect(uri);
await mongoose.connection.db.collection("bookings").deleteMany({});
console.log("[RESET] bookings vaciados");
await mongoose.disconnect();
