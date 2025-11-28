// Crear checkout (USD 10)
app.post("/api/payments/create-checkout", async (req, res) => {
  try {
    if (!stripe || !STRIPE_SECRET_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Stripe no está configurado (falta STRIPE_SECRET_KEY)"
      });
    }

    console.log("[INFO] Creando Checkout USD 10...");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 1000,
            product_data: { name: "Test pago I GUIDE U" }
          },
          quantity: 1
        }
      ],
      success_url: `${FRONTEND_URL}/stripe-success`,
      cancel_url: `${FRONTEND_URL}/stripe-cancel`
    });

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
