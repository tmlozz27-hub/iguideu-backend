// scripts/cleanup-duplicates-bookings-v2.js
import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/iguideu_local";

function isSafeTrashV2(b) {
  const email = b.email;
  const emailEmpty =
    email === undefined ||
    email === null ||
    String(email).trim() === "" ||
    String(email).toLowerCase() === "undefined" ||
    String(email).toLowerCase() === "null";

  const total = Number(b.total ?? b.amount ?? b.price ?? 0);

  const status = String(b.status || "").toUpperCase().trim();
  const statusOk = status === "" || status === "CREATED";

  const hasPaymentSignals = Boolean(
    b.stripeSessionId ||
      b.sessionId ||
      b.paymentIntentId ||
      b.payment_intent ||
      b.paidAt ||
      b.paid_at ||
      b.isPaid ||
      b.paid === true ||
      String(b.status || "").toUpperCase().trim() === "PAID" ||
      String(b.status || "").toUpperCase().trim() === "SUCCEEDED"
  );

  return emailEmpty && total === 0 && statusOk && !hasPaymentSignals;
}

function keyOf(b) {
  const email = String(b.email || "").toLowerCase().trim();
  const guideId = String(b.guideId ?? b.guide?.guideId ?? b.guide?._id ?? "").trim();
  const place = String(b.place || b.city || b.location || "").toLowerCase().trim();
  const duration = String(b.duration || b.durationType || "").toUpperCase().trim();
  const date = String(b.date || b.day || b.startDate || "").trim();
  const total = Number(b.total ?? b.amount ?? b.price ?? 0);
  const status = String(b.status || "").toUpperCase().trim();
  return `${email}|${guideId}|${place}|${duration}|${date}|${total}|${status}`;
}

async function main() {
  const DO_DELETE = process.argv.includes("--delete");

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection("bookings");

  const docs = await col.find({}).toArray();
  const safe = docs.filter(isSafeTrashV2);

  const map = new Map();
  for (const b of safe) {
    const k = keyOf(b);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(b);
  }

  const dupGroups = [...map.entries()].filter(([_, arr]) => arr.length > 1);

  const toDelete = [];
  const keep = [];

  for (const [k, arr] of dupGroups) {
    arr.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a._id).localeCompare(String(b._id));
    });

    keep.push({ key: k, keepId: String(arr[0]._id), createdAt: arr[0].createdAt });

    for (let i = 1; i < arr.length; i++) {
      toDelete.push({
        key: k,
        _id: String(arr[i]._id),
        createdAt: arr[i].createdAt,
        guideName: arr[i].guideName || arr[i].guide?.name || "",
        status: arr[i].status ?? "",
      });
    }
  }

  const out = {
    mode: DO_DELETE ? "DELETE" : "DRY_RUN",
    totalBookings: docs.length,
    safeTrashCount: safe.length,
    dupGroups: dupGroups.length,
    keep,
    toDeleteCount: toDelete.length,
    toDelete,
    generatedAt: new Date().toISOString(),
  };

  const outPath = `./_cleanup_plan_bookings_v2_${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");

  console.log("TOTAL bookings:", out.totalBookings);
  console.log("SAFE trash V2 bookings:", out.safeTrashCount);
  console.log("DUP groups (safe trash V2):", out.dupGroups);
  console.log("WOULD DELETE:", out.toDeleteCount);
  console.log("PLAN saved to:", outPath);

  if (DO_DELETE && toDelete.length > 0) {
    const ids = toDelete.map((x) => new mongoose.Types.ObjectId(x._id));
    const res = await col.deleteMany({ _id: { $in: ids } });
    console.log("DELETE RESULT deletedCount:", res.deletedCount);
  } else if (DO_DELETE) {
    console.log("Nothing to delete.");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
