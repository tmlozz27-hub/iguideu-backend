import mongoose from "mongoose"

const BookingSchema = new mongoose.Schema(
  {
    travelerName: { type: String, default: "" },
    travelerEmail: { type: String, required: true, index: true },

    guideId: { type: String, default: "" },
    guideName: { type: String, default: "" },

    city: { type: String, default: "" },
    country: { type: String, default: "" },
    date: { type: String, default: "" },

    duration: { type: String, default: "HOURS" },
    hours: { type: Number, default: 0 },

    currency: { type: String, default: "usd" },
    price: { type: Number, default: 0 },

    total: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },

    amountCents: { type: Number, default: 0 },
    totalCents: { type: Number, default: 0 },
    totalAmountCents: { type: Number, default: 0 },

    status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "PAID", "COMPLETED"],
      index: true,
    },

    stripePaymentIntentId: { type: String, default: "", index: true },
  paymentIntentCreationLock: { type: String, default: "" },
  paymentIntentCreationLockExpiresAt: { type: Date, default: null },
    stripeTransferId: { type: String, default: "", index: true },
    guidePayoutAmountCents: { type: Number, default: 0 },
    guidePayoutAttempt: { type: Number, default: 0 },
    guidePayoutStatus: {
      type: String,
      default: "NOT_READY",
      enum: ["NOT_READY", "READY", "PROCESSING", "TRANSFERRED", "FAILED"]
    },
    guidePayoutEligibleAt: { type: Date, default: null },
    guidePayoutProcessingAt: { type: Date, default: null },
    guidePayoutTransferredAt: { type: Date, default: null },
    guidePayoutError: { type: String, default: "" },

  // Airwallex: independent from Stripe Connect.
  airwallexTransferId: { type: String, default: "", index: true },
  airwallexRequestId: { type: String, default: "" },
  airwallexBatchId: { type: String, default: "", index: true },
  airwallexBeneficiaryId: { type: String, default: "" },
  airwallexPayoutStatus: {
    type: String,
    default: "NOT_STARTED",
    enum: [
      "NOT_STARTED",
      "PROCESSING",
      "SENT",
      "COMPLETED",
      "FAILED",
      "RECONCILIATION_REQUIRED"
    ]
  },
  airwallexProcessingAt: { type: Date, default: null },
  airwallexCompletedAt: { type: Date, default: null },
  airwallexPayoutError: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancellationLock: { type: String, default: "" },
    cancellationLockAt: { type: Date, default: null },
    cancellationStripeRefundId: { type: String, default: "" },
    cancellationRefundStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "SUCCEEDED", "RECONCILIATION_REQUIRED"],
      default: "NOT_STARTED"
    },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema)
