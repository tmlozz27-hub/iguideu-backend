import express from "express";
const router = express.Router();

function htmlPage(title, deepLink) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;padding:24px}
    .card{max-width:520px;margin:0 auto;border:1px solid #ddd;border-radius:12px;padding:18px}
    .btn{display:inline-block;padding:12px 16px;border-radius:10px;border:1px solid #111;text-decoration:none;color:#111;font-weight:700}
    .muted{color:#666;font-size:14px;margin-top:10px}
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>Volvé a la app para ver el estado.</p>
    <a class="btn" href="${deepLink}">Volver a la app</a>
    <div class="muted">Si no abre sola, tocá el botón.</div>
  </div>

  <script>
    // intentamos abrir la app automáticamente
    setTimeout(function(){
      window.location.href = "${deepLink}";
    }, 300);
  </script>
</body>
</html>`;
}

// GET /payment/success?session_id=...&bookingId=...
router.get("/payment/success", (req, res) => {
  const sessionId = req.query.session_id || "";
  const bookingId = req.query.bookingId || "";
  const deepLink = `iguideu://payment/success?session_id=${encodeURIComponent(
    sessionId
  )}&bookingId=${encodeURIComponent(bookingId)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlPage("✅ Pago exitoso (TEST)", deepLink));
});

// GET /payment/cancel?bookingId=...
router.get("/payment/cancel", (req, res) => {
  const bookingId = req.query.bookingId || "";
  const deepLink = `iguideu://payment/cancel?bookingId=${encodeURIComponent(
    bookingId
  )}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlPage("❌ Pago cancelado", deepLink));
});

export default router;
