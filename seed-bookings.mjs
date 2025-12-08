import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const bookingSchema = new mongoose.Schema({
  guideName: String,
  city: String,
  country: String,
  duration: String,
  total: Number,
  email: String,
  paymentStatus: String,
  meta: Object,
  stripeCheckoutSessionId: String,
  createdAt: Date,
  updatedAt: Date,
});

const Booking = mongoose.model("Booking", bookingSchema);

async function run() {
  try {
    console.log("Conectando a Mongo:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado.");

    const now = new Date();

    const bookings = [
      {
        guideName: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        duration: "FULL_DAY_24H (24 hs)",
        total: 220,
        email: "test+frontend@iguideu.com",
        paymentStatus: "PAID",
        meta: { durationType: "FULL_DAY_24H", hoursCount: null },
        stripeCheckoutSessionId: "cs_test_demo_full_day_1",
        createdAt: now,
        updatedAt: now,
      },
      {
        guideName: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        duration: "HOURS (3 hs)",
        total: 54,
        email: "test+frontend@iguideu.com",
        paymentStatus: "PAID",
        meta: { durationType: "HOURS", hoursCount: 3 },
        stripeCheckoutSessionId: "cs_test_demo_hours_3",
        createdAt: now,
        updatedAt: now,
      },
      {
        guideName: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        duration: "HOURS (5 hs)",
        total: 90,
        email: "test+frontend@iguideu.com",
        paymentStatus: "PAID",
        meta: { durationType: "HOURS", hoursCount: 5 },
        stripeCheckoutSessionId: "cs_test_demo_hours_5",
        createdAt: now,
        updatedAt: now,
      },
      {
        guideName: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        duration: "DAY (8 hs)",
        total: 110,
        email: "test+frontend@iguideu.com",
        paymentStatus: "PAID",
        meta: { durationType: "DAY", hoursCount: 8 },
        stripeCheckoutSessionId: "cs_test_demo_day_8",
        createdAt: now,
        updatedAt: now,
      },
      {
        guideName: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        duration: "HOURS (4 hs)",
        total: 60,
        email: "test+frontend@iguideu.com",
        paymentStatus: "PAID",
        meta: { durationType: "HOURS", hoursCount: 4 },
        stripeCheckoutSessionId: "cs_test_demo_maya_4h",
        createdAt: now,
        updatedAt: now,
      },
      {
        guideName: "Sofia – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        duration: "DAY (8 hs)",
        total: 120,
        email: "test+frontend@iguideu.com",
        paymentStatus: "PAID",
        meta: { durationType: "DAY", hoursCount: 8 },
        stripeCheckoutSessionId: "cs_test_demo_sofia_day",
        createdAt: now,
        updatedAt: now,
      },
    ];

    await Booking.deleteMany({});
    const result = await Booking.insertMany(bookings);

    console.log(`✔️ Reservas insertadas: ${result.length}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error en seed-bookings:", err);
    process.exit(1);
  }
}

run();
