const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

router.post("/google", async (req, res) => {
  try {
    const { token, email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    // 🔥 USAMOS EMAIL REAL DE GOOGLE
    const jwtToken = jwt.sign(
      { email },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    return res.json({
      token: jwtToken,
      email,
      name: name || "",
    });
  } catch (err) {
    return res.status(500).json({ error: "Error Google login" });
  }
});

module.exports = router;
