// Crear checkout (USD 10)
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    // ...
    const session = await stripe.checkout.sessions.create({ /* ... */ });

    console.log("[OK] Checkout:", session.id);

    res.json({
      ok: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    console.error("❌ Error creando checkout:", err.message);
    res.status(500).json({ ok: false, error: "Error en Stripe Checkout" });
  }
});
