import { Router } from "express";

const router = Router();

/**
 * Chat API MINIMA (mock) para que la app no falle.
 * Guarda todo en memoria (se pierde al reiniciar).
 * Luego lo pasamos a Mongo cuando esté estable.
 */

const conversationsByEmail = new Map(); // email -> [conversations]
const messagesByConvId = new Map();     // conversationId -> [messages]

function makeId(prefix = "c") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "chat", ts: Date.now() });
});

// GET /api/chat/conversations?email=...
router.get("/conversations", (req, res) => {
  const email = (req.query.email || "").toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Missing email" });

  const list = conversationsByEmail.get(email) || [];
  res.json(list);
});

// POST /api/chat/conversations  { email, title?, participantEmail? }
router.post("/conversations", (req, res) => {
  const email = (req.body?.email || "").toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Missing email" });

  const conv = {
    id: makeId("conv"),
    email,
    title: (req.body?.title || "Chat").toString(),
    participantEmail: (req.body?.participantEmail || "").toString(),
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  };

  const list = conversationsByEmail.get(email) || [];
  list.unshift(conv);
  conversationsByEmail.set(email, list);
  messagesByConvId.set(conv.id, []);

  res.status(201).json(conv);
});

// GET /api/chat/messages?conversationId=...
router.get("/messages", (req, res) => {
  const conversationId = (req.query.conversationId || "").toString().trim();
  if (!conversationId) return res.status(400).json({ error: "Missing conversationId" });

  const msgs = messagesByConvId.get(conversationId) || [];
  res.json(msgs);
});

// POST /api/chat/messages  { conversationId, from, text }
router.post("/messages", (req, res) => {
  const conversationId = (req.body?.conversationId || "").toString().trim();
  const from = (req.body?.from || "user").toString();
  const text = (req.body?.text || "").toString();

  if (!conversationId) return res.status(400).json({ error: "Missing conversationId" });
  if (!text) return res.status(400).json({ error: "Missing text" });

  const msg = {
    id: makeId("msg"),
    conversationId,
    from,
    text,
    createdAt: new Date().toISOString(),
  };

  const msgs = messagesByConvId.get(conversationId) || [];
  msgs.push(msg);
  messagesByConvId.set(conversationId, msgs);

  res.status(201).json(msg);
});

export default router;
