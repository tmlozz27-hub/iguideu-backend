// routes/paymentReturnPages.js (ESM)
// Páginas simples para redirect de Stripe (success/cancel)

import express from "express";

const router = express.Router();

router.get("/payment/success", (req, res) => {
  const sessionId = String(req.query.session_id || "").trim();

  res
    .status(200)
    .set("Content-Type", "text/html; charset=utf-8")
    .send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Pago confirmado</title>
          <style>
            body{font-family:Arial, sans-serif; padding:24px; line-height:1.4}
            .card{max-width:720px;margin:0 auto;border:1px solid #ddd;border-radius:12px;padding:18px}
            code{background:#f5f5f5;padding:2px 6px;border-radius:6px}
            a{display:inline-block;margin-top:12px}
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✅ Pago confirmado</h2>
            <p>Tu pago fue procesado correctamente.</p>
            <p>Session ID: <code>${sessionId || "N/A"}</code></p>
            <p>Ya podés volver a la app.</p>
          </div>
        </body>
      </html>
    `);
});

router.get("/payment/cancel", (req, res) => {
  res
    .status(200)
    .set("Content-Type", "text/html; charset=utf-8")
    .send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Pago cancelado</title>
          <style>
            body{font-family:Arial, sans-serif; padding:24px; line-height:1.4}
            .card{max-width:720px;margin:0 auto;border:1px solid #ddd;border-radius:12px;padding:18px}
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Pago cancelado</h2>
            <p>El pago fue cancelado. Podés intentar de nuevo desde la app.</p>
          </div>
        </body>
      </html>
    `);
});

export default router;
