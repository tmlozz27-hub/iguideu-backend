const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// LOGIN GOOGLE
router.post("/google", async (req, res) => {
  try {
    const { token, email, name } = req.body;

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!token) {
      return res.status(400).json({ error: "Token requerido" });
    }

    if (!cleanEmail) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const jwtToken = jwt.sign(
      {
        email: cleanEmail,
        name: name || "",
        role: "traveler"
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    return res.json({
      token: jwtToken,
      email: cleanEmail,
      name: name || "",
      user: {
        email: cleanEmail,
        name: name || "",
        role: "traveler"
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Error Google login" });
  }
});

// PERFIL (LO QUE USA LA APP)
router.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({ error: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

    return res.json({
      user: {
        email: decoded.email || "",
        name: decoded.name || "",
        role: decoded.role || "traveler"
      }
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
