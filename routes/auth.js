const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token requerido" });
    }

    // 🔥 TEMPORAL: login directo (NO rompe nada existente)
    const email = "googleuser@iguideu.app";

    const jwtToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    return res.json({
      token: jwtToken,
      email,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error Google login" });
  }
});

module.exports = router;