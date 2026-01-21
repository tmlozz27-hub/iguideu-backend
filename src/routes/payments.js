import { Router } from "express";

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

export default function paymentsRoutes({ Payment } = {}) {
  const router = Router();

  // GET /api/payments
  router.get("/", async (_req, res) => {
    try {
      if (!Payment) return res.status(500).json({ ok: false, error: "Payment model missing" });

      const items = await Payment.find({}).sort({ createdAt: -1 }).limit(200);
      res.json({ ok: true, items });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // POST /api/payments
  // Si el body trae un monto (amountUsd/totalUsd/amount/total), calcula comisión 10%
  router.post("/", async (req, res) => {
    try {
      if (!Payment) return res.status(500).json({ ok: false, error: "Payment model missing" });

      const body = req.body || {};

      const amountRaw =
        body.amountUsd ?? body.totalUsd ?? body.amount ?? body.total ?? 0;

      const amountUsd = round2(amountRaw);
      const platformFeeUsd = round2(amountUsd * 0.1);
      const guidePayoutUsd = round2(amountUsd - platformFeeUsd);

      const doc = await Payment.create({
        ...body,
        currency: body.currency || "USD",
        amountUsd: body.amountUsd ?? amountUsd,
        platformFeeUsd: body.platformFeeUsd ?? platformFeeUsd,
        guidePayoutUsd: body.guidePayoutUsd ?? guidePayoutUsd,
      });

      res.status(201).json({ ok: true, item: doc });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  // GET /api/payments/:id
  router.get("/:id", async (req, res) => {
    try {
      if (!Payment) return res.status(500).json({ ok: false, error: "Payment model missing" });

      const item = await Payment.findById(req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });

  return router;
}
