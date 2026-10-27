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
  const amountCents = Number(booking.guidePayoutAmountCents);

  if (
    payout.id !== payoutId ||
    payout.currency !== "usd" ||
    payout.amount !== amountCents ||
    payout.status !== "paid"
  ) {
    return {
      bookingId: String(bookingId),
      readyToMarkReceived: false,
      reason: "STRIPE_PAYOUT_NOT_VERIFIED"
    };
  }

  const deposits = await listAirwallexLiveDeposits();
  if (!Array.isArray(deposits)) {
    throw new Error("AIRWALLEX_DEPOSIT_LIST_INCOMPLETE");
  }

  const candidates = deposits.filter(d =>
    d.status === "SETTLED" &&
    d.currency === "USD" &&
    Math.round(Number(d.amount) * 100) === amountCents &&
    Boolean(d.settled_at) &&
    Boolean(d.provider_transaction_id) &&
    Boolean(d.global_account_id)
  );

  const stripeTrace = String(payout.trace_id?.value || "").replace(/\D/g, "");

  const verified = candidates.filter(d => {
    const bankReferences = [
      d.reference,
      d.provider_transaction_id,
      d.bank_reference,
      d.trace_id,
      d.ach_trace_id
    ].filter(v => typeof v === "string");

    const exactTraceMatch = bankReferences.some(value => {
      const tokens = value.match(/(?<!\d)\d{15}(?!\d)/g) || [];
      return tokens.includes(stripeTrace);
    });

    return (
      payout.trace_id?.status === "supported" &&
      stripeTrace.length === 15 &&
      exactTraceMatch
    );
  });

  if (verified.length !== 1) {
    return {
      bookingId: String(bookingId),
      stripePayoutId: payoutId,
      candidateDepositIds: candidates.map(d => d.id),
      airwallexReceiptConfirmed: false,
      readyToMarkReceived: false,
      reason: "BANK_REFERENCE_NOT_VERIFIED"
    };
  }

  const deposit = verified[0];

  return verifyAirwallexDepositForFunding({
    deposit,
    stripePayout: payout,
    booking,
    independentlyMatched: true
  });
}

export async function reconcileAndRecordStripeFundingReceipt(
  Booking,
  bookingId
) {
  const receipt = await inspectStripeFundingReceipt(Booking, bookingId);

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

  const recorded = await recordStripeFundingReceipt(Booking, receipt);

  return {
    ...recorded,
    recorded: true
  };
}
