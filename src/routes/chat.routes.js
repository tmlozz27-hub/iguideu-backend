import express from "express";

const router = express.Router();

/**
 * Chat minimal API (MongoDB via mongoose connection)
 * Collections:
 * - chat_conversations
 * - chat_messages
 */

function col(req, name) {
  const db = req.app.get("db");
  if (!db) throw new Error("DB_NOT_READY");
  return db.collection(name);
}

// GET /api/chat/conversations?email=...
router.get("/conversations", async (req, res) => {
  try {
    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email required" });

    const conversations = await col(req, "chat_conversations")
      .find({ email })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    return res.json({ ok: true, conversations });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", details: String(e?.message || e) });
  }
});

// GET /api/chat/messages?conversationId=...
router.get("/messages", async (req, res) => {
  try {
    const conversationId = (req.query.conversationId || "").toString().trim();
    if (!conversationId) return res.status(400).json({ ok: false, error: "conversationId required" });

    const messages = await col(req, "chat_messages")
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();

    return res.json({ ok: true, messages });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", details: String(e?.message || e) });
  }
});

// POST /api/chat/message
// body: { email, conversationId?, from?, text }
router.post("/message", async (req, res) => {
  try {
    const email = (req.body?.email || "").toString().trim().toLowerCase();
    const text = (req.body?.text || "").toString().trim();
    const from = (req.body?.from || "traveler").toString().trim(); // traveler | guide | system
    let conversationId = (req.body?.conversationId || "").toString().trim();

    if (!email) return res.status(400).json({ ok: false, error: "email required" });
    if (!text) return res.status(400).json({ ok: false, error: "text required" });

    const now = new Date();

    // si no viene conversationId, creamos una conversación nueva simple
    if (!conversationId) {
      conversationId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      await col(req, "chat_conversations").insertOne({
        conversationId,
        email,
        title: "New chat",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // si existe, actualizamos updatedAt; si no existe, la creamos
      await col(req, "chat_conversations").updateOne(
        { conversationId, email },
        {
          $setOnInsert: { conversationId, email, title: "Chat", createdAt: now },
          $set: { updatedAt: now },
        },
        { upsert: true }
      );
    }

    const msg = {
      conversationId,
      email,
      from,
      text,
      createdAt: now,
    };

    await col(req, "chat_messages").insertOne(msg);

    return res.json({ ok: true, conversationId, message: msg });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", details: String(e?.message || e) });
  }
});

export default router;
