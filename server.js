// === DIAGNÓSTICO VISUAL ===
app.get("/api/_whoami", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route?.path) routes.push(m.route.path);
    else if (m.name === "router" && m.handle?.stack) {
      m.handle.stack.forEach((s) => s.route?.path && routes.push(s.route.path));
    }
  });
  res.json({
    commit: process.env.RENDER_GIT_COMMIT || "unknown",
    node: process.version,
    entry: "server.js",
    routesCount: routes.length,
    sample: routes.slice(0, 20),
  });
});

// ⚠️ LOG explícito para ver en Render logs
console.log("🟩 Montando BYPASS /api/_orders_stats");

app.get("/api/_orders_stats", async (_req, res) => {
  try {
    const now = new Date();
    const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const from7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

    const [ total, byStatusAgg ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const byStatus = Object.fromEntries(byStatusAgg.map(i => [i._id, i.count]));

    const sumSucc = await Order.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, amount: 1 } },
    ]);
    const totalAmountSucceeded = sumSucc[0]?.amount || 0;

    const last24hAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: from24h } } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, count: 1, amount: 1 } },
    ]);
    const last24hSucc = await Order.aggregate([
      { $match: { createdAt: { $gte: from24h }, status: "succeeded" } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, count: 1, amount: 1 } },
    ]);

    const last7d = await Order.aggregate([
      { $match: { createdAt: { $gte: from7d }, status: "succeeded" } },
      { $group: {
          _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, d: { $dayOfMonth: "$createdAt" } },
          count: { $sum: 1 }, amount: { $sum: "$amount" }
      }},
      { $project: {
          _id: 0,
          date: { $dateFromParts: { year: "$_id.y", month: "$_id.m", day: "$_id.d" } },
          count: 1, amount: 1
      }},
      { $sort: { date: 1 } },
    ]);

    res.json({
      generatedAt: now.toISOString(),
      total,
      byStatus,
      totalAmountSucceeded,
      last24h: {
        count: last24hAgg[0]?.count || 0,
        amount: last24hAgg[0]?.amount || 0,
        succeeded: {
          count:  last24hSucc[0]?.count || 0,
          amount: last24hSucc[0]?.amount || 0,
        }
      },
      last7dSucceededDaily: last7d,
    });
  } catch (err) {
    console.error("[_orders_stats] error:", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});
