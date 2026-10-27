import { recordStripeFundingReceipt } from "./stripe-funding-receipt-record.js";
import { retrieveStripeGuideFundingPayout } from "./stripe-funding-live.js";
import { listAirwallexLiveDeposits } from "./client-live.js";
import { verifyAirwallexDepositForFunding } from "./verify-bank-deposit.js";

export async function inspectStripeFundingReceipt(
  Booking,
  bookingId,
  { depositId = "", independentlyMatched = false } = {}
) {
  if (process.env.AIRWALLEX_TEST_BOOKING_ID !== String(bookingId)) {
    throw new Error("TEST_BOOKING_MISMATCH");
  }

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw new Error("BOOKING_NOT_FOUND");

  if (booking.stripeFundingStatus !== "SENT") {
    throw new Error("STRIPE_FUNDING_NOT_SENT");
  }

  const payoutId = String(booking.stripeFundingPayoutId || "");

  if (!/^po_[A-Za-z0-9]+$/.test(payoutId)) {
    throw new Error("STRIPE_PAYOUT_ID_MISSING");
  }

  const payout = await retrieveStripeGuideFundingPayout(payoutId);

  if (
    payout.id !== payoutId ||
    payout.currency !== "usd" ||
    payout.amount !== Number(booking.guidePayoutAmountCents) ||
    payout.status !== "paid"
  ) {
    return {
      bookingId: String(bookingId),
      stripeStatus: payout.status,
      airwallexReceiptConfirmed: false,
      readyToMarkReceived: false
    };
  }

  if (!depositId || independentlyMatched !== true) {
    const deposits = await listAirwallexLiveDeposits();

    if (!Array.isArray(deposits)) {
      throw new Error("AIRWALLEX_DEPOSIT_LIST_INCOMPLETE");
    }

    const candidates = deposits.filter(d =>
      d.status === "SETTLED" &&
      d.currency === "USD" &&
      Number.isFinite(Number(d.amount)) &&
      Math.round(Number(d.amount) * 100) ===
        Number(booking.guidePayoutAmountCents)
    );

    return {
      bookingId: String(bookingId),
      stripePayoutId: payoutId,
      airwallexReceiptConfirmed: false,
      readyToMarkReceived: false,
      candidateDepositIds: candidates.map(d => d.id),
      reason: "INDEPENDENT_BANK_MATCH_REQUIRED"
    };
  }

  const deposits = await listAirwallexLiveDeposits();

  if (!Array.isArray(deposits)) {
    throw new Error("AIRWALLEX_DEPOSIT_LIST_INCOMPLETE");
  }

  const matches = deposits.filter(d => String(d.id) === String(depositId));

  if (matches.length !== 1) {
    throw new Error("AIRWALLEX_DEPOSIT_NOT_UNIQUELY_FOUND");
  }

  return verifyAirwallexDepositForFunding({
    deposit: matches[0],
    stripePayout: payout,
    booking,
    independentlyMatched
  });
}

export async function reconcileAndRecordStripeFundingReceipt(
  Booking,
  bookingId,
  { depositId = "", independentlyMatched = false } = {}
) {
  const receipt = await inspectStripeFundingReceipt(
    Booking,
    bookingId,
    { depositId, independentlyMatched }
  );

  if (
    receipt.airwallexReceiptConfirmed !== true ||
    receipt.readyToMarkReceived !== true
  ) {
    return {
      bookingId: String(bookingId),
      recorded: false,
      reason: receipt.reason || "RECEIPT_NOT_CONFIRMED"
    };
  }

  const recorded = await recordStripeFundingReceipt(
    Booking,
    receipt
  );

  return {
    ...recorded,
    recorded: true
  };
}