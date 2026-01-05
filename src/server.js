import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import guidesRouter from "./routes/guides.js";
import bookingsRouter from "./routes/bookings.js";
import chatRouter from "./routes/chat.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();

// --- Middlewares
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "2mb" }));

// --- Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- Mongo connect
async function connectMongo() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.log("❌ MONGO_URI vacío (definilo en el shell o .env)");
    return;
  }
  await mongoose.connect(uri);
  console.log("MongoDB OK -> dbName=" + mongoose.connection.db.databaseName);
}

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4020);

// 👇 colección a usar para guías (tu caso: "guides")
const GUIDE_COLLECTION = process.env.GUIDE_COLLECTION || "guides";
app.locals.GUIDE_COLLECTION = GUIDE_COLLECTION;
console.log("Using GUIDE_COLLECTION ->", GUIDE_COLLECTION);

// --- Routes
app.use("/api/guides", guidesRouter);
console.log("Routes OK -> guides mounted at /api/guides");

app.use("/api/bookings", bookingsRouter);
console.log("Routes OK -> bookings mounted at /api/bookings");

app.use("/api/chat", chatRouter);
console.log("Routes OK -> chat mounted at /api/chat");

app.use("/api/auth", authRouter);
console.log("Routes OK -> auth mounted at /api/auth");

// --- Start
connectMongo()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server ON -> http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Mongo connect error:", err?.message || err);
    process.exit(1);
  });

export default app;
