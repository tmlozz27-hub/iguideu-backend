SCRIPTS – backend-iguideu-24

1) cleanup-bookings.js
- Limpieza de "unknown" bookings + backup automático.

2) cleanup-bookings-by-email.cjs
- Limpieza por travelerEmail (segura) + backup automático.
- Uso:
  node .\scripts\cleanup-bookings-by-email.cjs "test+frontend@iguideu.com"

Backups:
- scripts\_backup_unknown_bookings_*.json
- scripts\_backup_bookings_email_*.json
- Copias blindadas en:
  C:\Users\Tom\Desktop\BACKUPS_IGUIDEU
