import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// público
router.get("/", (req, res) => {
  return res.json({
    count: 2,
    guides: [
      { id: "g1001", name: "Alice", city: "Buenos Aires" },
      { id: "g1002", name: "Bob", city: "Madrid" },
    ],
  });
});

// protegido (requiere token válido)
router.get("/:id/secure", requireAuth, (req, res) => {
  const { id } = req.params;
  return res.json({
    id,
    secure: true,
    requestedBy: req.user?.email,
  });
});

export default router;
