import { claimStripeFunding } from "./stripe-funding-claim.js";
import {
  createStripeGuideFundingPayout,
  retrieveStripeGuideFundingPayout
} from "./stripe-funding-live.js";
import { recordStripeFundingPayout } from "./stripe-funding-record.js";

export async function executeStripeGuideFunding(
  Booking,
  bookingId,
  amountCents,
  { enabled = false } = {}
) {
  if (!enabled) {
    throw new Error("STRIPE_FUNDING_EXECUTION_DISABLED");
  }

  if (process.env.STRIPE_FUNDING_LIVE_ENABLED !== "true") {
    throw new Error("STRIPE_FUNDING_LIVE_DISABLED");
  }

  const funding = await inspectStripeFunding(Booking, bookingId);

  if (!funding.canRequestNewPayout) {
    throw new Error("STRIPE_FUNDING_ALREADY_STARTED_RECONCILE_FIRST");
  }

  const claimed = await claimStripeFunding(
    Booking,
    bookingId,
    amountCents
  );

  let payout;

  try {
    payout = await createStripeGuideFundingPayout({
      bookingId,
      amountCents,
      enabled: true
    });
  } catch (error) {
    await Booking.updateOne(
      {
        _id: bookingId,
        stripeFundingStatus: "PROCESSING",
        stripeFundingPayoutId: { $in: ["", null] }
      },
      {
        $set: {
          stripeFundingStatus: "RECONCILIATION_REQUIRED",
          stripeFundingError: String(error?.message || "UNKNOWN_STRIPE_ERROR").slice(0, 500)
        }
      }
    );

    throw new Error(
      "STRIPE_PAYOUT_OUTCOME_UNCERTAIN_MANUAL_RECONCILIATION_REQUIRED"
    );
  }

  return recordStripeFundingPayout(
    Booking,
    bookingId,
    payout
  );
}

export async function inspectStripeFunding(Booking, bookingId) {
  const booking = await Booking.findById(bookingId).lean();

  if (!booking) {
    throw new Error("BOOKING_NOT_FOUND");
  }

  const status = booking.stripeFundingStatus || "NOT_STARTED";
  const payoutId = booking.stripeFundingPayoutId || "";

  return {
    bookingId: String(booking._id),
    status,
    payoutId,
    amountCents: Number(booking.guidePayoutAmountCents),
    requiresReconciliation:
      status === "PROCESSING" ||
      status === "RECONCILIATION_REQUIRED",
    canRequestNewPayout:
      status === "NOT_STARTED" && !payoutId
  };
}

export async function reconcileStripeFunding(Booking, bookingId) {
  const funding = await inspectStripeFunding(Booking, bookingId);

  if (!funding.payoutId) {
    throw new Error("PAYOUT_ID_MISSING_MANUAL_RECONCILIATION");
  }

  const payout = await retrieveStripeGuideFundingPayout(
    funding.payoutId
  );

  if (
    payout.id !== funding.payoutId ||
    payout.amount !== funding.amountCents ||
    payout.currency !== "usd"
  ) {
    throw new Error("STRIPE_PAYOUT_MISMATCH");
  }

  return {
    bookingId: funding.bookingId,
    payoutId: payout.id,
    amountCents: payout.amount,
    stripeStatus: payout.status,
    arrivalDate: payout.arrivalDate,
    airwallexReceiptConfirmed: false,
    requiresManualReceiptVerification: true
  };
}
