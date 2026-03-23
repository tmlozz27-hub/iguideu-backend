import express from "express";
import cors from "cors";
import { connectMongo } from "./services/mongo.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();
const HOST = "0.0.0.0";
const PORT = 4020;

app.use(cors({ origin: "*", credentials: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "OK_AUTH_ONLY" });
});

app.use("/api/auth", authRoutes);

await connectMongo();

app.listen(PORT, HOST, () => {
  console.log(`AUTH ONLY SERVER ON -> http://${HOST}:${PORT}`);
});