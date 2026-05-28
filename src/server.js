import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { connectMongo } from "./services/mongo.js"

import authRoutes from "./routes/auth.routes.js"
import guidesRoutes from "./routes/guides.routes.js"
import bookingsRoutes from "./routes/bookings.routes.js"
import paymentsRoutes from "./routes/payments.routes.js"
import stripeWebhookRoutes from "./routes/stripe.webhook.routes.js"
import chatRoutes from "./routes/chat.routes.js"

const app = express()

app.use(helmet())

app.use(cors({ origin: "*", credentials: false }))

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => (req.originalUrl || "").startsWith("/api/stripe/webhook")
})

app.use(apiLimiter)

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
    console.log(new Date().toISOString(), req.method, u)
  }
  next()
})

app.get("/api/health", (_req, res) => res.status(200).json({ status: "OK" }))

app.use("/api/auth", authRoutes)
app.use("/api/guides", guidesRoutes)
app.use("/api/bookings", bookingsRoutes)
app.use("/api/reservations", bookingsRoutes)
app.use("/api/payments", paymentsRoutes)
app.use("/api/stripe", stripeWebhookRoutes)
app.use("/api/chat", chatRoutes)

const HOST = process.env.HOST || "0.0.0.0"
const PORT = Number(process.env.PORT || 4020)

await connectMongo()

app.listen(PORT, HOST, () => {
  console.log(`Server ON -> http://${HOST}:${PORT}`)
})