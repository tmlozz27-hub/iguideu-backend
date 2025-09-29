import Order from "../models/order.model.js";

/**
 * Crea PaymentIntent en Stripe y guarda Order en Mongo
 */
export const createIntent = async (req, res) => {
  try {
    const stripe = req.app.get("stripe");
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }

    const { amount, currency = "usd", metadata = {} } = req.body || {};
    if (!amount || !Number.isInteger(amount)) {
      return res.status(400).json({ ok: false, error: "invalid_amount" });
    }

    // Forzamos solo tarjeta
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      payment_method_types: ["card"],
      metadata,
    });

    // Guardar Order
    const order = await Order.create({
      amount,
      currency,
      status: pi.status || "requires_payment_method",
      paymentIntentId: pi.id,
      metadata,
    });

    return res.json({
      ok: true,
      orderId: order._id,
      paymentIntentId: pi.id,
      clientSecret: pi.client_secret,
      status: order.status,
    });
  } catch (err) {
    console.error("❌ createIntent error:", err?.type || err?.name, err?.message);
    return res.status(500).json({
      ok: false,
      error: "stripe_or_db_error",
      detail: err?.message || "unknown",
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ ok: false, error: "not_found" });
    res.json(order);
  } catch {
    res.status(400).json({ ok: false, error: "bad_id" });
  }
};

export const getOrderByPaymentIntentId = async (req, res) => {
  const { paymentIntentId } = req.params;
  const order = await Order.findOne({ paymentIntentId }).lean();
  if (!order) return res.status(404).json({ ok: false, error: "not_found" });
  res.json(order);
};

export const listOrders = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(),
  ]);

  res.json({ page, limit, total, items });
};

export const stats = async (req, res) => {
  const mustKey = process.env.ADMIN_API_KEY;
  if (mustKey) {
    const k = req.header("x-admin-key");
    if (!k || k !== mustKey) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
  }

  const total = await Order.countDocuments();
  const byStatusAgg = await Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const byStatus = {};
  byStatusAgg.forEach((x) => (byStatus[x._id] = x.count));

  const last24hAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
        succeededAmount: {
          $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, "$amount", 0] },
        },
        succeededCount: {
          $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] },
        },
      },
    },
  ]);
  const last24h = last24hAgg[0] || { count: 0, amount: 0, succeededAmount: 0, succeededCount: 0 };

  res.json({
    generatedAt: new Date().toISOString(),
    total,
    byStatus,
    totalAmountSucceeded: last24h.succeededAmount,
    last24h: {
      count: last24h.count,
      amount: last24h.amount,
      succeeded: { count: last24h.succeededCount, amount: last24h.succeededAmount },
    },
  });
};

export const diagStripe = async (req, res) => {
  try {
    const stripe = req.app.get("stripe");
    if (!stripe) {
      return res.status(500).json({ ok: false, error: "stripe_not_configured" });
    }
    const keyPrefix = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_")
      ? "live"
      : (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_")
      ? "test"
      : "unknown";
    res.json({ ok: true, livemode: keyPrefix === "live", mode: keyPrefix });
  } catch (e) {
    res.status(500).json({ ok: false, error: "diag_failed", detail: e?.message });
  }
};
