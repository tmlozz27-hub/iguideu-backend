import { Router } from "express";
import Note from "../models/Note.js";

const r = Router();

r.get("/", async (_req, res) => {
  const items = await Note.find().sort({ createdAt: -1 }).limit(20);
  res.json({ ok: true, items });
});

r.post("/", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ ok: false, error: "text required" });
  const item = await Note.create({ text });
  res.status(201).json({ ok: true, item });
});

export default r;
