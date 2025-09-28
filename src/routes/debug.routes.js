import { Router } from "express";
const router = Router();

// PING: comprobar que llega tráfico
router.get("/ping", (_req, res) => res.json({ ok: true, pong: true, t: Date.now() }));

// MOCK bookings en memoria (solo DEBUG)
const _mem = [];
router.get("/bookings", (_req, res) => res.json({ ok: true, data: _mem }));
router.post("/bookings", (req, res) => {
  const { guide="g1", date, pax=1 } = req.body || {};
  if (!date) return res.status(400).json({ ok:false, error:"date requerido" });
  const id = "dbg_" + (_mem.length+1);
  const b = { id, guide, date, pax };
  _mem.push(b);
  res.json({ ok:true, booking:b });
});

export default router;
