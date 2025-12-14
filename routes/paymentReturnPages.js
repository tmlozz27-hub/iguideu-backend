import express from "express";
const router = express.Router();

function htmlPage(title, deepLink) {
  // Fallback Android Intent (sin package) -> suele abrir aunque Chrome bloquee custom scheme
  const intentLink = deepLink.replace(
    /^iguideu:\/\//,
    "intent://"
  ) + "#Intent;scheme=iguideu;end";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;padding:24px}
    .card{max-width:520px;margin:0 auto;border:1px solid #ddd;border-radius:12px;padding:18px}
    .btn{display:block;padding:12px 16px;border-radius:10px;border:2px solid #111;text-decoration:none;color:#111;font-weight:800;margin-top:10px;text-align:center}
    .muted{color:#666;font-size:14px;margin-top:12px}
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>Volvé a la app para ver el estado.</p>

    <a class="btn" href="${intentLink}">Volver a la app (Android)</a>
    <a class="btn" href="${deepLink}">Volver a la app (Link directo)</a>

    <div class="muted">
      Nota: El botón “← volver” de Stripe/Chrome NO vuelve a la app.
      Usá “Volver a la app” de acá.
    </div>
  </div>

  <script>
    // Intentamos automático (primero intent://, después iguideu://)
    setTimeout(function(){ window.location.href = "${intentLink}"; }, 300);
    setTimeout(function(){ window.location.href = "${deepLink}"; }, 900);
  </script>
</body>
</html>`;
}

router.get("/payment/success", (req, res) => {
  const sessionId = req.query.session_id || "";
  const bookingId = req.query.bookingId || "";
  const deepLink =
    `iguideu://payment/success?session_id=${encodeURIComponent(sessionId)}&bookingId=${encodeURIComponent(bookingId)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlPage("✅ Pago exitoso (TEST)", deepLink));
});

router.get("/payment/cancel", (req, res) => {
  const bookingId = req.query.bookingId || "";
  const deepLink =
    `iguideu://payment/cancel?bookingId=${encodeURIComponent(bookingId)}`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlPage("❌ Pago cancelado", deepLink));
});

export default router;
