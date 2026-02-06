import express from "express";
const router = express.Router();

router.post("/webhook", (_req, res) => {
  return res.status(200).send("ok");
});

export default router;
