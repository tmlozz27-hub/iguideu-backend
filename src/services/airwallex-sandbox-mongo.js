import mongoose from "mongoose";

const SANDBOX_DB = "iguideu_airwallex_sanbox";

export async function connectAirwallexSandboxMongo() {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  const uri = process.env.AIRWALLEX_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error("AIRWALLEX_SANDBOX_MONGO_URI_MISSING");
  }

  const connection = await mongoose.connect(uri, {
    dbName: SANDBOX_DB,
    serverSelectionTimeoutMS: 15000,
    autoIndex: false
  });

  if (connection.connection.name !== SANDBOX_DB) {
    await mongoose.disconnect();
    throw new Error("AIRWALLEX_SANDBOX_DATABASE_MISMATCH");
  }

  console.log("Airwallex Sandbox MongoDB connected");
  return connection.connection;
}
