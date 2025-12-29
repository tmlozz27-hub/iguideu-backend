import express from "express";
import cors from "cors";

const app = express();
const PORT = 4020;

app.use(express.json());
app.use(cors({ origin: "*", credentials: false }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, host: "0.0.0.0", port: PORT });
});

app.get("/api/guides", (_req, res) => {
  res.json({ ok: true, guides: [] });
});

app.get("/api/bookings", (_req, res) => {
  res.json({ ok: true, bookings: [] });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SERVER OK http://0.0.0.0:${PORT}`);
});
