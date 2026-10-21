import mongoose from "mongoose";

function asObjectId(value) {
  const id = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function pickGuideFilter(guideId) {
  const raw = String(guideId || "").trim();
  if (!raw) return null;
  const objectId = asObjectId(raw);
  return objectId ? { _id: objectId } : { guideId: raw };
}

// Both writes belong to one transaction: a retry cannot leave only one updated.
// MongoDB transactions require a replica set or sharded cluster.
export async function recordGuidePaidBooking(booking, source = "") {
  if (!mongoose.connection?.db || !booking) {
    return { ok: false, reason: "missing_db_or_booking" };
  }
  const bookingId = asObjectId(booking._id);
  const guideId = String(booking.guideId || "").trim();
  const guideFilter = pickGuideFilter(guideId);
  if (!bookingId || !guideFilter) {
    return { ok: false, reason: "invalid_booking_or_guide_id" };
  }

  const bookings = mongoose.connection.db.collection("bookings");
  const guides = mongoose.connection.db.collection("guides");
  const session = await mongoose.startSession();
  try {
    let outcome = null;
    await session.withTransaction(async () => {
      const existing = await bookings.findOne(
        { _id: bookingId },
        { session, projection: { status: 1, paidAt: 1, membershipTrackedAt: 1, guideId: 1 } }
      );
      if (!existing) throw new Error("booking_not_found");
      if (!["PAID", "COMPLETED"].includes(existing.status) || !existing.paidAt) {
        throw new Error("booking_not_paid");
      }
      if (String(existing.guideId || "") !== guideId) throw new Error("guide_id_mismatch");
      if (existing.membershipTrackedAt) {
        outcome = { ok: true, skipped: true, reason: "already_tracked" };
        return;
      }

      const guide = await guides.findOne(guideFilter, { session, projection: { _id: 1 } });
      if (!guide) throw new Error("guide_not_found");
      const now = new Date();
      const marked = await bookings.updateOne(
        { _id: bookingId, membershipTrackedAt: null },
        { $set: { membershipTrackedAt: now, membershipTrackedFrom: String(source || "") } },
        { session }
      );
      if (marked.modifiedCount !== 1) throw new Error("booking_tracking_conflict");

      // Pipeline updates calculate the next count on the server, avoiding lost increments.
      const count = { $add: [{ $ifNull: ["$stats.totalPaidBookings", 0] }, 1] };
      const updated = await guides.updateOne(
        { _id: guide._id },
        [{ $set: {
          "stats.firstPaidBookingAt": { $ifNull: ["$stats.firstPaidBookingAt", now] },
          "stats.secondPaidBookingAt": {
            $cond: [ { $gte: [count, 2] }, { $ifNull: ["$stats.secondPaidBookingAt", now] }, { $ifNull: ["$stats.secondPaidBookingAt", null] } ]
          },
          "stats.lastPaidBookingAt": now,
          "stats.lastPaidBookingId": String(bookingId),
          "stats.totalPaidBookings": count,
          "membership.required": true,
          "membership.monthlyFeeUsd": { $ifNull: ["$membership.monthlyFeeUsd", 10] },
          "membership.requiredFromBookingCount": { $ifNull: ["$membership.requiredFromBookingCount", 2] }
        } }],
        { session }
      );
      if (updated.matchedCount !== 1) throw new Error("guide_update_failed");
      outcome = { ok: true, skipped: false, guideId, bookingId: String(bookingId) };
    });
    return outcome || { ok: false, reason: "transaction_no_result" };
  } catch (error) {
    return { ok: false, reason: error?.message || "membership_transaction_failed" };
  } finally {
    await session.endSession();
  }
}
