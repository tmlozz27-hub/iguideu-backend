// scripts/list-duplicates-bookings.js
import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/iguideu_local";

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
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const col = db.collection("bookings");
  const docs = await col.find({}).toArray();

  const map = new Map();
  for (const b of docs) {
    const k = keyOf(b);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(b);
  }

  const dups = [...map.entries()].filter(([_, arr]) => arr.length > 1);

  console.log("TOTAL bookings:", docs.length);
  console.log("DUP groups:", dups.length);

  // mostrar solo los 20 primeros grupos para no explotar consola
  dups.slice(0, 20).forEach(([k, arr], idx) => {
    console.log("\n=== DUP GROUP", idx + 1, "count=", arr.length);
    console.log("key=", k);
    arr.forEach((b) => {
      console.log(
        " - _id=",
        String(b._id),
        "createdAt=",
        b.createdAt,
        "guideName=",
        b.guideName || b.guide?.name || "",
        "email=",
        b.email
      );
    });
  });

  if (dups.length > 20) {
    console.log(
      `\n(Se omitieron ${dups.length - 20} grupos; si queres, lo exportamos a JSON/CSV)`
    );
  }

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e?.message || e);
    process.exit(1);
  });

