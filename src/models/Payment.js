import mongoose from "mongoose"

const PaymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    travelerEmail: { type: String, default: "" },
    guideName: { type: String, default: "" },

    amountCents: { type: Number, required: true },
    currency: { type: String, default: "usd" },

    status: { type: String, default: "PENDING", index: true },

    stripePaymentIntentId: { type: String, default: "", index: true },

    platformFeeCents: { type: Number, default: 0 },
    paidAt: { type: Date, default: null }
  },
  { timestamps: true }
)

export default mongoose.model("Payment", PaymentSchema)