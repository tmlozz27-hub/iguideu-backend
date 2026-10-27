import mongoose from "mongoose";
import { connectMongo } from "./services/mongo.js";
import Booking from "./models/Booking.js";
import Guide from "./models/Guide.js";
import { executeStripeGuideFunding, inspectStripeFunding } from "./services/airwallex/stripe-funding-executor.js";
import { reconcileAndRecordStripeFundingReceipt } from "./services/airwallex/stripe-funding-reconciliation.js";
import { reconcileAirwallexLiveTransfers } from "./services/airwallex/airwallex-live-transfer-reconciliation.js";
import { runAirwallexLiveWeeklyPayoutCycle } from "./services/airwallex/weekly-payout-cycle-live.js";

const on = name => process.env[name] === "true";
const empty = { $in: ["", null] };
const noPayout = { $or: [{ airwallexPayoutStatus: "NOT_STARTED" }, { airwallexPayoutStatus: { $exists: false } }] };
function eligible(b, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ""))) return false;
  const start = new Date(`${b.date}T00:00:00.000Z`);
  const hours = Number(b.hours);
  const amount = Number(b.amountCents);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(hours) || hours <= 0) return false;
  if (!(b.paidAt instanceof Date) || !Number.isFinite(b.paidAt.getTime())) return false;
  if (!/^pi_[A-Za-z0-9]+$/.test(String(b.stripePaymentIntentId || ""))) return false;
  if (!Number.isSafeInteger(amount) || amount <= 0 || Number(b.guidePayoutAmountCents) !== Math.round(amount * 0.9)) return false;
  if (String(b.currency || "").toLowerCase() !== "usd") return false;
  if (b.stripeTransferId || b.airwallexTransferId || b.airwallexBatchId) return false;
  if (!["NOT_READY", "READY"].includes(b.guidePayoutStatus)) return false;
  if (b.airwallexPayoutStatus && b.airwallexPayoutStatus !== "NOT_STARTED") return false;
  return now.getTime() >= start.getTime() + hours * 3600000 + 48 * 3600000;
}
async function scan(query, handler) {
  let last = null;
  for (;;) {
    const q = last ? { $and: [query, { _id: { $gt: last } }] } : query;
    const page = await Booking.find(q).sort({ _id: 1 }).limit(200).lean();
    if (!page.length) break;
    last = page[page.length - 1]._id;
    for (const booking of page) await handler(booking);
  }
}
async function prepare(now) {
  let count = 0;
  await scan({ status: "PAID" }, async b => {
    if (!eligible(b, now)) return;
    const end = new Date(`${b.date}T00:00:00.000Z`).getTime() + Number(b.hours) * 3600000 + 48 * 3600000;
    const result = await Booking.updateOne({
      _id: b._id, status: "PAID", guidePayoutStatus: { $in: ["NOT_READY", "READY"] },
      stripeTransferId: empty, airwallexTransferId: empty, airwallexBatchId: empty,
      ...noPayout
    }, { $set: { status: "COMPLETED", completedAt: now, guidePayoutStatus: "READY", guidePayoutEligibleAt: new Date(end) } });
    count += result.modifiedCount || 0;
  });
  return count;
}
async function reconcileReceipts() {
  let checked = 0, received = 0, pending = 0, errors = 0;
  await scan({ status: "COMPLETED", stripeFundingStatus: "SENT", stripeFundingPayoutId: { $exists: true, $nin: ["", null] } }, async b => {
    checked++;
    try {
      const result = await reconcileAndRecordStripeFundingReceipt(Booking, String(b._id));
      if (result.recorded) received++; else pending++;
    } catch (e) {
      errors++;
      console.error("FUNDING_RECEIPT_RECONCILIATION_FAILED", String(b._id), e.message);
    }
  });
  return { checked, received, pending, errors };
}
async function fund(now) {
  let sent = 0, skipped = 0, errors = 0;
  await scan({ status: "COMPLETED", guidePayoutStatus: "READY", guidePayoutEligibleAt: { $lte: now },
    stripeFundingStatus: { $in: ["NOT_STARTED", null] }, stripeFundingPayoutId: empty,
    stripeTransferId: empty, airwallexTransferId: empty, airwallexBatchId: empty, ...noPayout
  }, async b => {
    const id = String(b._id), cents = Number(b.guidePayoutAmountCents);
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents !== Math.round(Number(b.amountCents) * 0.9) ||
        String(b.currency).toLowerCase() !== "usd" || !/^pi_[A-Za-z0-9]+$/.test(String(b.stripePaymentIntentId || ""))) { skipped++; return; }
    try {
      const state = await inspectStripeFunding(Booking, id);
      if (!state.canRequestNewPayout) { skipped++; return; }
      await executeStripeGuideFunding(Booking, id, cents, { enabled: true });
      sent++;
    } catch (e) { errors++; console.error("FUNDING_FAILED_RECONCILE_BEFORE_RETRY", id, e.message); }
  });
  return { sent, skipped, errors };
}
async function main() {
  if (process.env.AIRWALLEX_ENV !== "live") throw new Error("AIRWALLEX_LIVE_ONLY");
  const fundEnabled = on("STRIPE_FUNDING_LIVE_ENABLED");
  const payEnabled = on("AIRWALLEX_LIVE_PAYOUTS_ENABLED");
  const reconcileOnly = on("STRIPE_FUNDING_RECONCILE_ONLY");
  if (on("STRIPE_FUNDING_DRY_RUN") && (fundEnabled || payEnabled)) throw new Error("DRY_RUN_WITH_LIVE_EXECUTION_FORBIDDEN");
  if (!fundEnabled && !payEnabled && !reconcileOnly) throw new Error("NO_BANKING_MODE_ENABLED");
  await connectMongo();
  console.log("TRANSFER_RECONCILIATION", JSON.stringify(await reconcileAirwallexLiveTransfers(Booking)));
  console.log("RECEIPT_RECONCILIATION", JSON.stringify(await reconcileReceipts()));
  if (reconcileOnly) return;
  const now = new Date();
  console.log("ELIGIBILITY_PREPARED", await prepare(now));
  if (fundEnabled) console.log("FUNDING", JSON.stringify(await fund(now)));
  // A booking is payout-eligible only after its individual Stripe payout is independently matched to a settled Airwallex deposit.
  if (payEnabled) console.log("GUIDE_PAYOUTS", JSON.stringify(await runAirwallexLiveWeeklyPayoutCycle(Booking, Guide, now)));
}
try { await main(); } finally { await mongoose.disconnect(); }
