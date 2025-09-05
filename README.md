# iguideu-backend

## Requisitos
- Node 20+
- MongoDB local
- `.env` (ver .env.example)

## Instalar
npm install

## Desarrollo
npm run dev

## Salud
GET http://127.0.0.1:3000/api/health

## Auth
POST /api/auth/signup {email,password,name}
POST /api/auth/login  {email,password}
GET  /api/auth/me     (Bearer token)

## Bookings
POST   /api/bookings             (Bearer) {guide,startAt,endAt,price}
PATCH  /api/bookings/:id/confirm (Bearer)
PATCH  /api/bookings/:id/cancel  (Bearer)
GET    /api/bookings             (Bearer)
