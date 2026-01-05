import mongoose from "mongoose";

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const colName = process.env.GUIDE_COLLECTION || "guides";

if (!uri) {
  console.log("❌ MONGO_URI vacío en este shell");
  process.exit(1);
}

function isDraftZero(g) {
  const hasId = !!g.id;
  const rating = g.rating ?? null;

  const hourly =
    g.hourlyRate ??
    g.priceHour ??
    g.pricePerHourUsd ??
    g.pricePerHourUSD ??
    0;

  const daily =
    g.dailyRate ??
    g.priceDay ??
    g.pricePerDayUsd ??
    g.pricePerDayUSD ??
    0;

  const h = Number(hourly) || 0;
  const d = Number(daily) || 0;

  return !hasId && (rating === null) && h === 0 && d === 0;
}

(async () => {
  console.log("== CLEANUP GUIDES ZEROS ==");
  await mongoose.connect(uri);
  console.log("DB =>", mongoose.connection.db.databaseName);

  const col = mongoose.connection.db.collection(colName);
  const docs = await col.find({}).toArray();

  const toDelete = docs.filter(isDraftZero);
  console.log("Found drafts =>", toDelete.length);

  if (toDelete.length) {
    const ids = toDelete.map((d) => d._id);
    const r = await col.deleteMany({ _id: { $in: ids } });
    console.log("Deleted =>", r.deletedCount);
  }

  await mongoose.disconnect();
  console.log("DONE.");
})();
