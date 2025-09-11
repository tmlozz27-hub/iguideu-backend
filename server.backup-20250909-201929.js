import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import authRouter from "./src/routes/auth.routes.js";
import bookingsRouter from "./src/routes/bookings.routes.js";
import adminRouter from "./src/routes/admin.routes.js";
import guidesRouter from "./src/routes/guides.routes.js";

// Seguridad / hardening
import { applyHardening } from "./src/middlewares/hardening.mjs";

const app = express();

// Aplica seguridad
applyHardening(app);

// Static (mini-frontend)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

// Rutas API
app.use("/api/auth", authRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/guides", guidesRouter);

// Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

// Conexión MongoDB + arranque servidor
const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGO_URI, { dbName: "iguideu" })
  .then(() => {
    console.log(`[OK] MongoDB conectado`);
    app.listen(PORT, () =>
      console.log(`[OK] Servidor Express en 127.0.0.1:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("[ERROR] MongoDB:", err);
    process.exit(1);
  });
