import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();

/* =========================
   BASIC MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   MONGO
========================= */
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "iguideu20";

mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log("✅ Mongo conectado:", DB_NAME))
  .catch((e) => console.error("❌ Mongo error:", e));

/* =========================
   MODELS
========================= */
const BookingSchema = new mongoose.Schema(
  {
    guideId: { type: mongoose.Schema.Types.ObjectId, required: true },
    guideName: { type: String, required: true },
    travelerEmail: { type: String, required: true },

    hoursRequested: { type: Number, required: true },
    durationType: {
      type: String,
      enum: ["HOURS", "DAY_8H", "FULL_DAY_24H"],
      required: true,
    },

    totalUsd: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);

/* =========================
   HELPERS
========================= */
function inferDurationType(hours) {
  if (hours === 24) return "FULL_DAY_24H";
  if (hours >= 8) return "DAY_8H";
  return "HOURS";
}

/* =========================
   ROUTES
========================= */

// health
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// CREATE BOOKING (FASE 4)
app.post("/api/bookings", async (req, res) => {
  try {
    const { guideId, guideName, travelerEmail, hoursRequested, totalUsd } =
      req.body || {};

    if (!guideId || !guideName || !hoursRequested || totalUsd === undefined) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const hours = Number(hoursRequested);
    const total = Number(totalUsd);

    if (!Number.isFinite(hours) || hours <= 0)
      return res.status(400).json({ ok: false, error: "Invalid hours" });

    if (!Number.isFinite(total) || total < 0)
      return res.status(400).json({ ok: false, error: "Invalid total" });

    const booking = await Booking.create({
      guideId,
      guideName,
      travelerEmail: travelerEmail || "test+frontend@iguideu.com",
      hoursRequested: hours,
      durationType: inferDurationType(hours),
      totalUsd: total,
      paymentStatus: "pending",
    });

    res.json({
      ok: true,
      bookingId: booking._id.toString(),
      booking,
    });
  } catch (e) {
    console.error("❌ POST /api/bookings", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Backend running on port", PORT);
});
