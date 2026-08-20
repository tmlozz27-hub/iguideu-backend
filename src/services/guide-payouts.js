import mongoose from "mongoose";
import Stripe from "stripe";

const PAYOUT_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

function asObjectId(value) {
  const id = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : null;
}

function pickGuideFilter(guideId) {
  const raw = String(guideId || "").trim();
  if (!raw) return null;

  const objectId = asObjectId(raw);
  if (objectId) return { _id: objectId };

  return { guideId: raw };
}

async function findExistingTransferForBooking(stripe, booking, accountId, amount, currency) {
  const bookingId = String(booking._id);
  const transferGroup = `BOOKING_${bookingId}`;

  const transfers = await stripe.transfers.list({
    destination: accountId,
    transfer_group: transferGroup,
    limit: 10
  });

  const matches = (transfers.data || []).filter((transfer) => {
    return (
      String(transfer?.metadata?.bookingId || "") === bookingId &&
      String(transfer?.destination || "") === accountId &&
      Number(transfer?.amount || 0) === amount &&
      String(transfer?.currency || "").toLowerCase() === currency &&
      String(transfer?.transfer_group || "") === transferGroup
    );
  });

  if (matches.length > 1) {
    return { ok: false, ambiguous: true, transfer: null };
  }

  return {
    ok: true,
    ambiguous: false,
    transfer: matches[0] || null
  };
}

export async function processGuidePayout(bookingId) {
  const db = mongoose.connection?.db;
  const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();

  if (!db) {
    return { ok: false, skipped: true, reason: "missing_db" };
  }

  if (!stripeSecretKey) {
    return { ok: false, skipped: true, reason: "stripe_not_configured" };
  }

  const objectId = asObjectId(bookingId);

  if (!objectId) {
    return { ok: false, skipped: true, reason: "invalid_booking_id" };
  }

  const bookingsCol = db.collection("bookings");
  const guidesCol = db.collection("guides");

  const booking = await bookingsCol.findOne({ _id: objectId });

  if (!booking) {
    return { ok: false, skipped: true, reason: "booking_not_found" };
  }

  if (
    booking.guidePayoutStatus !== "READY" &&
    booking.guidePayoutStatus !== "PROCESSING"
  ) {
    return { ok: true, skipped: true, reason: "payout_not_ready" };
  }

  if (String(booking.stripeTransferId || "").trim()) {
    return { ok: true, skipped: true, reason: "transfer_already_recorded" };
  }

  const amount = Number(booking.guidePayoutAmountCents || 0);

  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, skipped: true, reason: "invalid_payout_amount" };
  }

  const guideFilter = pickGuideFilter(booking.guideId);

  if (!guideFilter) {
    return { ok: false, skipped: true, reason: "invalid_guide_filter" };
  }

  const guide = await guidesCol.findOne(guideFilter);

  if (!guide) {
    return { ok: false, skipped: true, reason: "guide_not_found" };
  }

  const accountId = String(guide?.stripeConnect?.accountId || "").trim();

  if (
    !accountId ||
    !guide?.stripeConnect?.onboardingComplete ||
    !guide?.stripeConnect?.payoutsEnabled
  ) {
    return { ok: false, skipped: true, reason: "guide_connect_not_ready" };
  }

  if (booking.guidePayoutStatus === "PROCESSING") {
    const processingAt = booking.guidePayoutProcessingAt
      ? new Date(booking.guidePayoutProcessingAt).getTime()
      : 0;

    const processingAgeMs = processingAt
      ? Date.now() - processingAt
      : Number.POSITIVE_INFINITY;

    if (processingAgeMs < PAYOUT_PROCESSING_TIMEOUT_MS) {
      return { ok: true, skipped: true, reason: "payout_processing_recent" };
    }

    const stripe = new Stripe(stripeSecretKey);
    const currency = String(booking.currency || "usd").toLowerCase();

    try {
      const reconciliation = await findExistingTransferForBooking(
        stripe,
        booking,
        accountId,
        amount,
        currency
      );

      if (reconciliation.ambiguous) {
        return { ok: false, skipped: true, reason: "payout_reconciliation_ambiguous" };
      }

      if (!reconciliation.transfer) {
        return { ok: false, skipped: true, reason: "payout_reconciliation_not_found" };
      }

      const transferId = String(reconciliation.transfer.id || "").trim();

      if (!transferId) {
        return { ok: false, skipped: true, reason: "payout_reconciliation_invalid_transfer" };
      }

      const recovered = await bookingsCol.updateOne(
        {
          _id: objectId,
          guidePayoutStatus: "PROCESSING",
          stripeTransferId: { $in: [null, ""] }
        },
        {
          $set: {
            guidePayoutStatus: "TRANSFERRED",
            stripeTransferId: transferId,
            guidePayoutTransferredAt: new Date(),
            guidePayoutError: ""
          }
        }
      );

      if (!recovered.modifiedCount) {
        return { ok: true, skipped: true, reason: "payout_reconciliation_already_resolved" };
      }

      return {
        ok: true,
        skipped: false,
        recovered: true,
        bookingId: String(booking._id),
        transferId,
        amount,
        currency
      };
    } catch (error) {
      return {
        ok: false,
        skipped: true,
        reason: "payout_reconciliation_failed"
      };
    }
  }

  const claim = await bookingsCol.updateOne(
    {
      _id: objectId,
      guidePayoutStatus: "READY",
      stripeTransferId: { $in: [null, ""] }
    },
    {
      $set: {
        guidePayoutStatus: "PROCESSING",
        guidePayoutProcessingAt: new Date(),
        guidePayoutError: ""
      }
    }
  );

  if (!claim.modifiedCount) {
    return { ok: true, skipped: true, reason: "payout_already_claimed" };
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const transfer = await stripe.transfers.create(
      {
        amount,
        currency: String(booking.currency || "usd").toLowerCase(),
        destination: accountId,
        transfer_group: `BOOKING_${booking._id}`,
        metadata: {
          bookingId: String(booking._id),
          guideId: String(booking.guideId || "")
        }
      },
      {
        idempotencyKey: `guide-payout-${booking._id}`
      }
    );

    await bookingsCol.updateOne(
      {
        _id: objectId,
        guidePayoutStatus: "PROCESSING"
      },
      {
        $set: {
          guidePayoutStatus: "TRANSFERRED",
          stripeTransferId: String(transfer.id || ""),
          guidePayoutTransferredAt: new Date(),
          guidePayoutError: ""
        }
      }
    );

    return {
      ok: true,
      skipped: false,
      bookingId: String(booking._id),
      transferId: String(transfer.id || ""),
      amount,
      currency: String(booking.currency || "usd").toLowerCase()
    };
  } catch (error) {
    await bookingsCol.updateOne(
      {
        _id: objectId,
        guidePayoutStatus: "PROCESSING"
      },
      {
        $set: {
          guidePayoutStatus: "READY",
          guidePayoutError: String(error?.code || "STRIPE_TRANSFER_FAILED")
        }
      }
    );

    return {
      ok: false,
      skipped: false,
      reason: "stripe_transfer_failed"
    };
  }
}
