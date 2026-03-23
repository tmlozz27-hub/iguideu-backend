import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4020);
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "iguideu20";

console.log("PORT:", PORT);
console.log("MONGO_URI:", MONGO_URI ? "OK" : "MISSING");
console.log("DB_NAME:", DB_NAME);

if (!MONGO_URI) {
  console.error("FALTA MONGO_URI EN .env");
  process.exit(1);
}

await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
console.log("MongoDB OK -> dbName=" + mongoose.connection.name);

const GuideSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    country: String,
    city: String,
    bio: String,
    languages: [String],
    pricePerHour: Number,
  },
  { timestamps: true }
);

const Guide = mongoose.models.Guide || mongoose.model("Guide", GuideSchema);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    server: "auth-guides-only",
    db: mongoose.connection.name,
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    console.log("LOGIN HIT ->", {
      email: email || "",
      hasPassword: !!password,
    });

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "EMAIL_REQUIRED",
        message: "EMAIL_REQUIRED",
      });
    }

    const safeEmail = String(email).trim().toLowerCase();

    return res.status(200).json({
      ok: true,
      success: true,
      message: "LOGIN_OK",
      token: "test-token-iguideu",
      accessToken: "test-token-iguideu",
      user: {
        id: "test-user-1",
        _id: "test-user-1",
        name: "Tomás",
        email: safeEmail,
        role: "traveler",
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR ->", error);
    return res.status(500).json({
      ok: false,
      error: "LOGIN_ERROR",
      message: "LOGIN_ERROR",
    });
  }
});

app.get("/api/auth/me", async (req, res) => {
  return res.status(200).json({
    ok: true,
    user: {
      id: "test-user-1",
      _id: "test-user-1",
      name: "Tomás",
      email: "tomaslozz@yahoo.com.ar",
      role: "traveler",
    },
  });
});

app.get("/api/guides", async (req, res) => {
  try {
    const guides = await Guide.find().limit(50).lean();
    return res.json(guides);
  } catch (error) {
    console.error("GUIDES ERROR ->", error);
    return res.status(500).json({ error: "GUIDES_ERROR" });
  }
});

app.get("/api/guides/by-country", async (req, res) => {
  try {
    const country = String(req.query.country || "").trim();
    if (!country) {
      return res.status(400).json({ error: "COUNTRY_REQUIRED" });
    }

    const guides = await Guide.find({ country }).limit(50).lean();
    return res.json(guides);
  } catch (error) {
    console.error("GUIDES COUNTRY ERROR ->", error);
    return res.status(500).json({ error: "GUIDES_COUNTRY_ERROR" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER OK -> http://0.0.0.0:${PORT}`);
});