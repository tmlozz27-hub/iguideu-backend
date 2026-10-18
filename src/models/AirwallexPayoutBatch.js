import mongoose from "mongoose";

const AirwallexPayoutBatchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    required: true,
    unique: true
  },
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  guideId: {
    type: String,
    required: true
  },
  beneficiaryId: {
    type: String,
    required: true
  },
  bookingIds: {
    type: [String],
    required: true,
    validate: {
      validator: value => Array.isArray(value) && value.length > 0,
      message: "AIRWALLEX_BATCH_BOOKINGS_REQUIRED"
    }
  },
  amountCents: {
    type: Number,
    required: true,
    min: 1
  },
  currency: {
    type: String,
    required: true,
    enum: ["USD"]
  },
  status: {
    type: String,
    required: true,
    default: "PREPARED",
    enum: [
      "PREPARED",
      "PROCESSING",
      "SENT",
      "COMPLETED",
      "RECONCILIATION_REQUIRED"
    ]
  },
  transferId: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

AirwallexPayoutBatchSchema.index(
  { transferId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transferId: { $type: "string", $gt: "" }
    }
  }
);
export default mongoose.models.AirwallexPayoutBatch ||
  mongoose.model("AirwallexPayoutBatch", AirwallexPayoutBatchSchema);
