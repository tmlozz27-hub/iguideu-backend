import express from "express";
import cors from "cors";
import mongoose from "mongoose";

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

/* =========================
   MONGO
========================= */
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "iguideu20";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in env");
}

mongoose
  .connect(MONGO_URI, { dbName: DB_NAME })
  .then(() => console.log("✅ Mongo conectado:", DB_NAME))
  .catch((e) => console.error("❌ Mongo error:", e));

/* =========================
   MODELS
========================= */
const GuideSchema = new mongoose.Schema(
  {
    name: String,
    city: String,
    country: String,
    hourlyRateUsd: Number,
    dayRateUsd: Number,
    fullDay24hRateUsd: Number,
    languages: [String],
    rating: Number,
    bio: String,
    imageUrl: String,
  },
  { timestamps: true, collection: "guides" } // 👈 importante: usa la colección existente
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", GuideSchema);

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
  { timestamps: true, collection: "bookings" }
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
app.get("/api/health", async (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "production", dbName: DB_NAME });
});

// ✅ RESTORE: GET /api/guides
app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ ok: true, guides });
  } catch (e) {
    console.error("❌ GET /api/guides", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ✅ PHASE 4: POST /api/bookings
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

    return res.json({
      ok: true,
      bookingId: booking._id.toString(),
      booking,
    });
  } catch (e) {
    console.error("❌ POST /api/bookings", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 Backend running on port", PORT);
});
