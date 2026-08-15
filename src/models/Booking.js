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
    stripeTransferId: { type: String, default: "", index: true },
    guidePayoutAmountCents: { type: Number, default: 0 },
    guidePayoutStatus: {
      type: String,
      default: "NOT_READY",
      enum: ["NOT_READY", "READY", "PROCESSING", "TRANSFERRED", "FAILED"]
    },
    guidePayoutEligibleAt: { type: Date, default: null },
    guidePayoutTransferredAt: { type: Date, default: null },
    guidePayoutError: { type: String, default: "" },

    paidAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema)