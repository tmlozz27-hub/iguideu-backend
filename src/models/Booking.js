import mongoose from "mongoose"

const BookingSchema = new mongoose.Schema(
  {
    travelerName: { type: String, default: "" },
    travelerEmail: { type: String, required: true, index: true },

    guideId: { type: String, default: "" },
    guideName: { type: String, default: "" },
    guideEmail: { type: String, default: "" },

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
    amountUsd: { type: Number, default: 0 },

    amountCents: { type: Number, default: 0 },
    totalCents: { type: Number, default: 0 },
    totalAmountCents: { type: Number, default: 0 },

    status: {
      type: String,
      default: "PENDING",
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "PAID"],
      index: true,
    },

    stripePaymentIntentId: { type: String, default: "", index: true },
    paymentMode: { type: String, default: "" },
    paymentStatus: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, default: "" },
    cancelledBy: { type: String, default: "" },
    refundStatus: {
      type: String,
      default: "",
      enum: ["", "none", "pending", "succeeded", "failed"],
    },
    refundRequestedAt: { type: Date, default: null },
    refundCompletedAt: { type: Date, default: null },
    refundAmountCents: { type: Number, default: 0 },
    stripeRefundId: { type: String, default: "" },
    membershipTrackedAt: { type: Date, default: null },
    membershipTrackedFrom: { type: String, default: "" },
  },
  { timestamps: true }
)

export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema)