// routes/guides.js
import express from "express";

const router = express.Router();

// Guías de DEMO para pruebas
const demoGuides = [
  {
    id: "arun-bangkok",
    name: "Arun – Bangkok Local Guide",
    city: "Bangkok",
    country: "Tailandia",
    rating: 4.8,
    priceHour: 18,
    priceDay: 110,
  },
  {
    id: "maya-kathmandu",
    name: "Maya – Kathmandu Cultural Guide",
    city: "Kathmandu",
    country: "Nepal",
    rating: 5.0,
    priceHour: 15,
    priceDay: 95,
  },
  {
    id: "sofia-buenosaires",
    name: "Sofía – Experta en Buenos Aires",
    city: "Buenos Aires",
    country: "Argentina",
    rating: 4.9,
    priceHour: 20,
    priceDay: 120,
  }
];

// GET /api/guides
router.get("/", (req, res) => {
  return res.json({
    ok: true,
    guides: demoGuides,
  });
});

export default router;
