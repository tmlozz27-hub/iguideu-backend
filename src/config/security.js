import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";

export function applySecurity(app) {
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  app.use(
    rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || "200", 10),
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(hpp());
  app.use(compression());
  app.use(mongoSanitize());
  app.use(xss());
}
