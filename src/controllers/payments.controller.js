export const createPaymentIntent = async (req, res) => {
  // Stub temporal: simula un client_secret, sin llamar a Stripe todavía.
  const { amount, currency = "usd" } = req.body || {};
  if (!amount) return res.status(400).json({ error: "amount requerido" });
  return res.json({
    ok: true,
    provider: "stub",
    client_secret: "pi_stub_client_secret",
    amount,
    currency
  });
};
