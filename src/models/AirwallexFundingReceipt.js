import mongoose from "mongoose";

const ReceiptSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, required: true },
  stripePayoutId: { type: String, required: true },
  amountCents: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  versionKey: false,
  collection: "airwallex_funding_receipts"
});

export default mongoose.models.AirwallexFundingReceipt ||
  mongoose.model("AirwallexFundingReceipt", ReceiptSchema);
