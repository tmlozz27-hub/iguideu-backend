import { Router } from "express";
const router = Router();

const store = new Map();

// Crea "intent" fake
router.post("/create-intent", (req, res) => {
  const { amount = 1999, currency = "usd" } = req.body || {};
  const id = `pi_stub_${Date.now()}`;
  store.set(id, { status: "requires_confirmation" });
  res.json({ ok: true, provider: "stub", id, client_secret: "pi_stub_secret_123", amount, currency });
});

// Confirma fake
router.post("/confirm-test", (req, res) => {
  const { intent_id } = req.body || {};
  const rec = store.get(intent_id);
  if (!rec) return res.status(404).json({ ok: false, error: "not found" });
  rec.status = "succeeded";
  res.json({ ok: true, id: intent_id, status: rec.status });
});

// Status fake
router.get("/status/:id", (req, res) => {
  const rec = store.get(req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true, id: req.params.id, status: rec.status });
});

export default router;
