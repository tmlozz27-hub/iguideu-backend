// src/routes/guides.routes.js
import { Router } from "express";
import authRequired from "../middlewares/authRequired.js";

const router = Router();

// Públicos
router.get("/", (req, res) => {
  return res.json({
    count: 2,
    guides: [
      { id: "g1001", name: "Alice", city: "Buenos Aires" },
      { id: "g1002", name: "Bob", city: "Madrid" },
    ],
  });
});

// Protegido de ejemplo
router.get("/:id/secure", authRequired, (req, res) => {
  return res.json({ id: req.params.id, secure: true });
});

export default router;
