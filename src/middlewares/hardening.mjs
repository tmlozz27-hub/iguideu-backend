import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import express from "express";

export function applyHardening(app) {
  // Ajustes básicos
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // CORS
  const allow = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map(s => s.trim());
  app.use(
    cors({
      origin: allow,
      credentials: true,
      methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
      allowedHeaders: ["Content-Type","Authorization"]
    })
  );

  // Helmet (contentSecurityPolicy simple para dev)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'","data:","blob:"],
          "script-src": ["'self'","'unsafe-inline'"],
          "connect-src": ["'self'", ...allow],
        },
    }})
  );

  // Body parsers
  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: true, limit: "200kb" }));

  // Rate limit (API)
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15*60*1000);
  const maxReq = Number(process.env.RATE_LIMIT_MAX || 300);
  app.use("/api", rateLimit({ windowMs, max: maxReq, standardHeaders: true, legacyHeaders: false }));

  // Pequeña sanitización básica (sin libs extra)
  app.use((req, _res, next) => {
    const scrub = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj)) {
        if (k.startsWith("$") || k.includes(".")) {
          const v = obj[k];
          delete obj[k];
          obj[`_${k.replace(/\./g,"_")}`] = v;
        } else if (typeof obj[k] === "object") {
          scrub(obj[k]);
        }
      }
    };
    scrub(req.body);
    scrub(req.query);
    scrub(req.params);
    next();
  });
}
