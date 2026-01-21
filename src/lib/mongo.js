import "dotenv/config";
import mongoose from "mongoose";

let _connected = false;

export async function connectMongo() {
  if (_connected) return;

  const uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    "";

  if (!uri) {
    throw new Error(
      "MONGO_URI (o MONGODB_URI/MONGO_URL) no está definido en .env"
    );
  }

  // logs útiles (sin exponer credenciales)
  const dbName =
    process.env.MONGO_DB ||
    process.env.DB_NAME ||
    undefined;

  const options = {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
    ...(dbName ? { dbName } : {}),
  };

  try {
    await mongoose.connect(uri, options);

    _connected = true;

    const name = mongoose.connection?.name || dbName || "unknown";
    console.log(`MongoDB OK -> dbName=${name}`);
  } catch (e) {
    _connected = false;
    console.error("MongoDB FAIL:", e?.message || e);
    throw e;
  }
}
