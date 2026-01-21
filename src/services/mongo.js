// src/services/mongo.js (ESM)
import mongoose from "mongoose";

const cached = global.__MONGO_CACHE__ || { conn: null, promise: null };
global.__MONGO_CACHE__ = cached;

function defineModels() {
  // GUIDE
  if (!mongoose.models.Guide) {
    const GuideSchema = new mongoose.Schema(
      {
        name: { type: String, required: true },
        country: { type: String, required: true },
        city: { type: String, required: true },
        languages: { type: [String], default: [] },
        pricePerHour: { type: Number, default: 0 },
        rating: { type: Number, default: 0 },
        active: { type: Boolean, default: true },
      },
      { timestamps: true }
    );
    mongoose.model("Guide", GuideSchema);
  }

  // BOOKING (mínimo)
  if (!mongoose.models.Booking) {
    const BookingSchema = new mongoose.Schema(
      {
        email: { type: String, default: "" },
        gid: { type: String, default: "" },
        status: { type: String, default: "pending" },
      },
      { timestamps: true }
    );
    mongoose.model("Booking", BookingSchema);
  }

  // RESERVATION (mínimo)
  if (!mongoose.models.Reservation) {
    const ReservationSchema = new mongoose.Schema(
      {
        email: { type: String, default: "" },
        gid: { type: String, default: "" },
        status: { type: String, default: "pending" },
      },
      { timestamps: true }
    );
    mongoose.model("Reservation", ReservationSchema);
  }

  // PAYMENT (mínimo)
  if (!mongoose.models.Payment) {
    const PaymentSchema = new mongoose.Schema(
      {
        email: { type: String, default: "" },
        amount: { type: Number, default: 0 },
        status: { type: String, default: "created" },
      },
      { timestamps: true }
    );
    mongoose.model("Payment", PaymentSchema);
  }

  return {
    Guide: mongoose.models.Guide,
    Booking: mongoose.models.Booking,
    Reservation: mongoose.models.Reservation,
    Payment: mongoose.models.Payment,
  };
}

export async function connectMongo() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!uri) {
    console.log("MongoDB SKIP -> missing MONGO_URI/MONGODB_URI");
    return null;
  }

  if (cached.conn) {
    // asegura modelos aunque ya haya conexión
    defineModels();
    console.log("MongoDB OK -> dbName=" + (cached.conn?.name || "connected"));
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 15000 })
      .then((m) => {
        cached.conn = m.connection;
        return cached.conn;
      });
  }

  cached.conn = await cached.promise;
  defineModels();

  console.log("MongoDB OK -> dbName=" + (cached.conn?.name || "connected"));
  return cached.conn;
}

export function getModels() {
  // garantiza que existan siempre
  return defineModels();
}

export function isMongoConnected() {
  return mongoose.connection?.readyState === 1;
}
