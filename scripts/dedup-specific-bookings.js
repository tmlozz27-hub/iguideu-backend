import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/iguideu_local";

const TARGET_KEYS = new Set([
  "test+booking@iguideu.com||bangkok|HOURS||54|",
  "|maya-kathmandu||HOURS||45|",
]);

function keyOf(b) {
  const email = String(b.email || "").toLowerCase().trim();
  const guideId = String(b.guideId ?? b.guide?.guideId ?? b.guide?._id ?? "").trim();
  const place = String(b.place || b.city || b.location || "").toLowerCase().trim();
  const duration = String(b.duration || b.durationType || "").toUpperCase().trim();
  const date = String(b.date || b.day || b.startDate || "").trim();
  const total = Number(b.total ?? b.amount ?? b.price ?? 0);
  const status = String(b.status || "").toUpperCase().trim();
  // ojo: tu list-duplicates usa un key sin status al final en estos casos,
  // por eso replicamos el formato "email|guideId|place|duration|date|total|"
  return `${email}|${guideId}|${place}|${duration}|${date}|${total}|${status ? status : ""}|`.replace(/\|\|$/, "||");
}

async function main() {
  const DO_DELETE = process.argv.includes("--delete");

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection("bookings");

  const docs = await col.find({}).toArray();

  // Agrupar solo target keys basados en el "key" impreso por tu script original.
  // Para evitar discrepancias, matcheamos por heurística: email + guideId + place + duration + date + total (sin status).
  function printedKeyLike(b) {
    const email = String(b.email || "").toLowerCase().trim();
    const guideId = String(b.guideId ?? b.guide?.guideId ?? b.guide?._id ?? "").trim();
    const place = String(b.place || b.city || b.location || "").toLowerCase().trim();
    const duration = String(b.duration || b.durationType || "").toUpperCase().trim();
    const date = String(b.date || b.day || b.startDate || "").trim();
    const total = Number(b.total ?? b.amount ?? b.price ?? 0);
    return `${email}|${guideId}|${place}|${duration}|${date}|${total}|`;
  }

  const groups = new Map();
  for (const b of docs) {
    const k = printedKeyLike(b);
    if (TARGET_KEYS.has(k)) {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(b);
    }
  }

  let toDelete = [];
  let keep = [];

  for (const [k, arr] of groups.entries()) {
    if (arr.length <= 1) continue;

    // keep newest
    arr.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return tb - ta; // newest first
      return String(b._id).localeCompare(String(a._id));
    });

    keep.push({ key: k, keepId: String(arr[0]._id), createdAt: arr[0].createdAt });

    for (let i = 1; i < arr.length; i++) {
      toDelete.push(String(arr[i]._id));
    }
  }

  console.log("TARGET groups found:", groups.size);
  console.log("WOULD DELETE:", toDelete.length);
  console.log("KEEP:", keep);

  if (DO_DELETE && toDelete.length > 0) {
    const ids = toDelete.map((x) => new mongoose.Types.ObjectId(x));
    const res = await col.deleteMany({ _id: { $in: ids } });
    console.log("DELETE RESULT deletedCount:", res.deletedCount);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
