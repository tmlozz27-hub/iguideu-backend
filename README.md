# iguideu-backend

- Node + Express + MongoDB
- Endpoints clave:
  - `GET /api/health`
  - `POST /api/auth/signup`, `POST /api/auth/login`
  - `GET /api/guides`
  - `POST /api/bookings`
  - `POST /api/payments/authorize/:id` | `POST /api/bookings/:id/payments/authorize`
  - `POST /api/payments/capture/:id`   | `POST /api/bookings/:id/payments/capture`
