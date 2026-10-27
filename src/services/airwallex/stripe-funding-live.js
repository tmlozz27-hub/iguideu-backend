import Stripe from "stripe";

export async function createStripeGuideFundingPayout({
  amountCents,
  bookingId,
  enabled = false
}) {
  if (!enabled) {
    throw new Error("STRIPE_FUNDING_DISABLED");
  }

  if (!/^[a-f0-9]{24}$/i.test(String(bookingId || ""))) {
    throw new Error("INVALID_BOOKING_ID");
  }

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("INVALID_FUNDING_AMOUNT");
  }

  const key = process.env.STRIPE_SECRET_KEY;

  if (!key?.startsWith("sk_live_")) {
    throw new Error("STRIPE_LIVE_KEY_REQUIRED");
  }

  const destination = process.env.STRIPE_AIRWALLEX_BANK_ACCOUNT_ID;
  if (destination !== "ba_1UNxmMR6PMgUVujbV1zjeKad") {
    throw new Error("STRIPE_AIRWALLEX_DESTINATION_MISMATCH");
  }

  const stripe = new Stripe(key);

  const payout = await stripe.payouts.create(
    {
      amount: amountCents,
      currency: "usd",
      method: "standard",
      destination,
      metadata: {
        purpose: "iguideu_guide_funding",
        bookingId: String(bookingId)
      }
    },
    {
      idempotencyKey: `iguideu-guide-funding-${bookingId}-v1`
    }
  );

  return {
    id: payout.id,
    amount: payout.amount,
    status: payout.status
  };
}
export async function retrieveStripeGuideFundingPayout(payoutId) {
  if (!/^po_[A-Za-z0-9]+$/.test(String(payoutId || ""))) {
    throw new Error("INVALID_STRIPE_PAYOUT_ID");
  }

  const key = process.env.STRIPE_SECRET_KEY;

  if (!key?.startsWith("sk_live_")) {
    throw new Error("STRIPE_LIVE_KEY_REQUIRED");
  }

  const stripe = new Stripe(key);
  const payout = await stripe.payouts.retrieve(payoutId);

  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status,
    arrivalDate: payout.arrival_date,
    trace_id: payout.trace_id ?? null
  };
}
