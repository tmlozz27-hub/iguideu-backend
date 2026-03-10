import mongoose from "mongoose"
import Booking from "../models/Booking.js"

const cached = global.__MONGO_CACHE__ || { conn: null, promise: null }
global.__MONGO_CACHE__ = cached

function defineModels() {
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
    )
    mongoose.model("Guide", GuideSchema)
  }

  if (!mongoose.models.Reservation) {
    const ReservationSchema = new mongoose.Schema(
      {
        email: { type: String, default: "" },
        gid: { type: String, default: "" },
        status: { type: String, default: "pending" },
      },
      { timestamps: true }
    )
    mongoose.model("Reservation", ReservationSchema)
  }

  if (!mongoose.models.Payment) {
    const PaymentSchema = new mongoose.Schema(
      {
        email: { type: String, default: "" },
        bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null },
        amount: { type: Number, default: 0 },
        currency: { type: String, default: "usd" },
        status: { type: String, default: "created" },
        stripePaymentIntentId: { type: String, default: "" },
        platformFeePercent: { type: Number, default: 10 },
        platformFeeAmount: { type: Number, default: 0 },
        guideNetAmount: { type: Number, default: 0 },
        lastEventId: { type: String, default: "" },
      },
      { timestamps: true }
    )

    PaymentSchema.index({ stripePaymentIntentId: 1 }, { unique: false })
    PaymentSchema.index({ bookingId: 1 }, { unique: false })

    mongoose.model("Payment", PaymentSchema)
  }

  return {
    Guide: mongoose.models.Guide,
    Booking,
    Reservation: mongoose.models.Reservation,
    Payment: mongoose.models.Payment,
  }
}

export async function connectMongo() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI

  if (!uri) {
    console.log("MongoDB SKIP -> missing MONGO_URI/MONGODB_URI")
    return null
  }

  if (cached.conn) {
    defineModels()
    console.log("MongoDB OK -> dbName=" + (cached.conn?.name || "connected"))
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 15000 })
      .then((m) => {
        cached.conn = m.connection
        return cached.conn
      })
  }

  cached.conn = await cached.promise
  defineModels()

  console.log("MongoDB OK -> dbName=" + (cached.conn?.name || "connected"))
  return cached.conn
}

export function getModels() {
  return defineModels()
}

export function isMongoConnected() {
  return mongoose.connection?.readyState === 1
}