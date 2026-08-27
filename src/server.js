import * as Sentry from "@sentry/node"

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "oldpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "identitytoken",
  "stripesignature",
  "stripe-signature",
  "clientsecret",
  "secret",
  "api_key",
  "apikey"
])

function sanitizeSensitive(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSensitive(item))
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const output = {}

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = String(key)
      .replace(/[_-]/g, "")
      .toLowerCase()

    if (
      SENSITIVE_KEYS.has(key) ||
      SENSITIVE_KEYS.has(normalizedKey)
    ) {
      output[key] = "[REDACTED]"
      continue
    }

    output[key] = sanitizeSensitive(item)
  }

  return output
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,

  beforeSend(event) {
    return sanitizeSensitive(event)
  },

  beforeBreadcrumb(breadcrumb) {
    return sanitizeSensitive(breadcrumb)
  }
})

import express from "express"
import cors from "cors"
import helmet from "helmet"
import { connectMongo } from "./services/mongo.js"

import authRoutes from "./routes/auth.routes.js"
import guidesRoutes from "./routes/guides.routes.js"
import bookingsRoutes from "./routes/bookings.routes.js"
import paymentsRoutes from "./routes/payments.routes.js"
import stripeWebhookRoutes from "./routes/stripe.webhook.routes.js"
import chatRoutes from "./routes/chat.routes.js"
import uploadRoutes from "./routes/upload.routes.js"

const app = express()

app.use(helmet())

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true)
      }

      const allowedOrigins = new Set([
        "https://www.i-guide-u.com",
        "https://i-guide-u.com"
      ])

      if (allowedOrigins.has(origin)) {
        return callback(null, true)
      }

      return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"))
    },
    credentials: false
  })
)

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }))

const jsonParser = express.json({ limit: "2mb" })
const urlParser = express.urlencoded({ extended: true, limit: "2mb" })

app.use((req, res, next) => {
  if ((req.originalUrl || "").startsWith("/api/stripe/webhook")) return next()
  jsonParser(req, res, next)
})

app.use((req, res, next) => {
  if ((req.originalUrl || "").startsWith("/api/stripe/webhook")) return next()
  urlParser(req, res, next)
})

app.use((req, res, next) => {
  const u = req.originalUrl || ""

  if (
    u.startsWith("/api/bookings") ||
    u.startsWith("/api/reservations") ||
    u.startsWith("/api/chat")
  ) {
    console.log(new Date().toISOString(), req.method, u.split("?")[0])
  }

  next()
})

app.get("/api/health", (_req, res) =>
  res.status(200).json({ status: "OK" })
)

app.use("/api/auth", authRoutes)
app.use("/api/guides", guidesRoutes)
app.use("/api/bookings", bookingsRoutes)
app.use("/api/reservations", bookingsRoutes)
app.use("/api/payments", paymentsRoutes)
app.use("/api/stripe", stripeWebhookRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/upload", uploadRoutes)

Sentry.setupExpressErrorHandler(app)

app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      error: "FILE_TOO_LARGE"
    })
  }

  if (err instanceof SyntaxError && err?.status === 400 && "body" in err) {
    return res.status(400).json({
      ok: false,
      error: "INVALID_JSON"
    })
  }

  if (err?.message === "CORS_ORIGIN_NOT_ALLOWED") {
    return res.status(403).json({
      ok: false,
      error: "CORS_ORIGIN_NOT_ALLOWED"
    })
  }

  return res.status(500).json({
    ok: false,
    error: "INTERNAL_SERVER_ERROR"
  })
})

const HOST = process.env.HOST || "0.0.0.0"
const PORT = Number(process.env.PORT || 4020)

await connectMongo()

app.listen(PORT, HOST, () => {
  console.log(`Server ON -> http://${HOST}:${PORT}`)
})