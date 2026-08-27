import mongoose from "mongoose";

const StripeEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    type: {
      type: String,
      default: "",
    },

    processedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

StripeEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

export default (
  mongoose.models.StripeEvent ||
  mongoose.model("StripeEvent", StripeEventSchema)
);