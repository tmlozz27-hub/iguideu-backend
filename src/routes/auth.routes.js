import express from "express";

const router = express.Router();

router.post("/login", (req, res) => {
  const email = String(req.body?.email || "");
  const token = "DEV_TOKEN_" + Buffer.from(email || "guest").toString("base64");
  return res.status(200).json({ ok: true, token });
});

export default router;
