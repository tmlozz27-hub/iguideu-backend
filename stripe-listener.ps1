# 🪟 PS2 - STRIPE (listener local)
$host.ui.RawUI.WindowTitle = 'PS2 - STRIPE (listener)'

# Importante: esto genera un whsec NUEVO a veces. Si cambia, actualiza STRIPE_WEBHOOK_SECRET en tu .env local.
stripe listen --forward-to http://127.0.0.1:4020/api/payments/webhook
