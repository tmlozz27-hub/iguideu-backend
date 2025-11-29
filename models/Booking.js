// models/Booking.js
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guide', required: false },
    guideName: { type: String, required: false },

    amountTotal: { type: Number, required: true },
    currency: { type: String, required: true },

    platformFee: { type: Number, required: true },
    guideNet: { type: Number, required: true },

    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String },

    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'paid',
    }
  },
  { timestamps: true }
);

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

export default Booking;
