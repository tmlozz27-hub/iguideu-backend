import express from "express";
const router = express.Router();

router.post("/create-intent", async (_req, res) => {
  return res.status(200).json({ ok: true, msg: "payments route alive" });
});

export default router;
