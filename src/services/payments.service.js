import Booking from "../models/Booking.js";

export async function markBookingPaid(bookingId, paymentIntentId) {
  const id = String(bookingId || "").trim();
  const pi = String(paymentIntentId || "").trim();

  if (!id) throw new Error("BOOKING_ID_REQUIRED");

  const update = {
    $set: {
      paymentStatus: "paid",
      status: "confirmed",
      stripePaymentIntentId: pi || null,
      paidAt: new Date(),
    },
  };

  const booking = await Booking.findByIdAndUpdate(id, update, { new: true });

  if (!booking) throw new Error("BOOKING_NOT_FOUND");

  return booking;
}