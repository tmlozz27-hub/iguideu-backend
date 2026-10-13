import mongoose from "mongoose";

export async function requirePayoutAdmin(req, res, next) {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const userId = String(req.user?.id || "").trim();

    const authorized = String(
      process.env.AIRWALLEX_PAYOUT_ADMIN_EMAILS || ""
    ).split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

    if (!email || !userId || !authorized.includes(email)) {
      return res.status(403).json({ ok: false, error: "PAYOUT_ADMIN_FORBIDDEN" });
    }

    if (!mongoose.isValidObjectId(userId) || !mongoose.connection?.db) {
      return res.status(403).json({ ok: false, error: "PAYOUT_ADMIN_IDENTITY_INVALID" });
    }

    const user = await mongoose.connection.db.collection("users").findOne(
      { _id: new mongoose.Types.ObjectId(userId), email },
      { projection: { _id: 1 } }
    );

    if (!user) {
      return res.status(403).json({ ok: false, error: "PAYOUT_ADMIN_IDENTITY_INVALID" });
    }

    return next();
  } catch {
    return res.status(403).json({ ok: false, error: "PAYOUT_ADMIN_FORBIDDEN" });
  }
}
