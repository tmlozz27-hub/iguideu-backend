import mongoose from "mongoose";

function asObjectId(value) {
  const id = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function pickGuideFilter(guideId) {
  const raw = String(guideId || "").trim();
  if (!raw) return null;

  const objectId = asObjectId(raw);
  if (objectId) return { _id: objectId };

  return { guideId: raw };
}

export async function recordGuidePaidBooking(booking, source = "") {
  try {
    const db = mongoose.connection?.db;
    if (!db || !booking) {
      return { ok: false, skipped: true, reason: "missing_db_or_booking" };
    }

    const bookingId = String(booking._id || "").trim();
    const guideId = String(booking.guideId || "").trim();

    if (!bookingId || !guideId) {
      return { ok: false, skipped: true, reason: "missing_booking_or_guide_id" };
    }

    const bookingsCol = db.collection("bookings");
    const guidesCol = db.collection("guides");

    const trackNow = new Date();

    const markBooking = await bookingsCol.updateOne(
      {
        _id: asObjectId(bookingId),
        membershipTrackedAt: { $exists: false }
      },
      {
        $set: {
          membershipTrackedAt: trackNow,
          membershipTrackedFrom: String(source || "")
        }
      }
    );

    if (!markBooking.modifiedCount) {
      return { ok: true, skipped: true, reason: "already_tracked" };
    }

    const guideFilter = pickGuideFilter(guideId);
    if (!guideFilter) {
      return { ok: false, skipped: true, reason: "invalid_guide_filter" };
    }

    const guide = await guidesCol.findOne(guideFilter);
    if (!guide) {
      return { ok: false, skipped: true, reason: "guide_not_found" };
    }

    const totalPaidBookings = Number(guide?.stats?.totalPaidBookings || 0);
    const nextTotalPaidBookings = totalPaidBookings + 1;
    const now = new Date();

    const membership = guide?.membership || {};
    const stats = guide?.stats || {};

    const nextMembership = {
      active: Boolean(membership.active),
      required: nextTotalPaidBookings >= 1,
      monthlyFeeUsd: Number(membership.monthlyFeeUsd || 10),
      requiredFromBookingCount: Number(membership.requiredFromBookingCount || 2),
      startedAt: membership.startedAt || null
    };

    const nextStats = {
      totalPaidBookings: nextTotalPaidBookings,
      firstPaidBookingAt: stats.firstPaidBookingAt || now,
      secondPaidBookingAt:
        nextTotalPaidBookings >= 2 ? stats.secondPaidBookingAt || now : stats.secondPaidBookingAt || null,
      lastPaidBookingAt: now,
      lastPaidBookingId: bookingId
    };

    await guidesCol.updateOne(
      guideFilter,
      {
        $set: {
          membership: nextMembership,
          stats: nextStats,
          updatedAt: now
        }
      }
    );

    return {
      ok: true,
      skipped: false,
      guideId,
      bookingId,
      totalPaidBookings: nextTotalPaidBookings,
      membershipRequired: nextMembership.required
    };
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      reason: error?.message || "guide_membership_track_error"
    };
  }
}