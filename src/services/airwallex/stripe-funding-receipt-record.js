import mongoose from "mongoose";
import AirwallexFundingReceipt from "../../models/AirwallexFundingReceipt.js";

export async function recordStripeFundingReceipt(Booking, receipt) {
  if (
    receipt?.readyToMarkReceived !== true ||
    receipt?.airwallexReceiptConfirmed !== true
  ) {
    throw new Error("AIRWALLEX_RECEIPT_NOT_CONFIRMED");
  }

  const {
    bookingId,
    stripePayoutId,
    airwallexDepositId,
    amountCents
  } = receipt;

  if (
    !/^po_[A-Za-z0-9]+$/.test(String(stripePayoutId || "")) ||
    !airwallexDepositId ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0
  ) {
    throw new Error("INVALID_FUNDING_RECEIPT");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await AirwallexFundingReceipt.create([{
        _id: String(airwallexDepositId),
        bookingId,
        stripePayoutId,
        amountCents
      }], { session });

      const result = await Booking.updateOne(
        {
          _id: bookingId,
          status: "COMPLETED",
          guidePayoutStatus: "READY",
          guidePayoutEligibleAt: { $lte: new Date() },
          stripeFundingStatus: "SENT",
          stripeFundingPayoutId: stripePayoutId,
          stripeFundingAmountCents: amountCents,
          guidePayoutAmountCents: amountCents,
          airwallexDepositId: { $in: ["", null] }
        },
        {
          $set: {
            stripeFundingStatus: "RECEIVED",
            airwallexDepositId: String(airwallexDepositId),
            stripeFundingError: ""
          }
        },
        { session }
      );

      if (result.modifiedCount !== 1) {
        throw new Error("AIRWALLEX_RECEIPT_RECORD_REJECTED");
      }
    });

    return {
      bookingId: String(bookingId),
      stripeFundingStatus: "RECEIVED",
      airwallexDepositId: String(airwallexDepositId)
    };
  } finally {
    await session.endSession();
  }
}
