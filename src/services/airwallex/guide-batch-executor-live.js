import { claimAirwallexGuideBatch } from "./guide-batch-claim.js";
import { validateAirwallexGuideForPayout } from "./guide-payout-validation.js";
import AirwallexPayoutBatch from "../../models/AirwallexPayoutBatch.js";
import { createAirwallexBatchManifest } from "./batch-manifest-store.js";
import { buildAirwallexGuideBatchPayloadGlobal } from "./guide-batch-payload-global.js";
import { createAirwallexLiveTransfer } from "./client-live.js";
import { recordAirwallexBatchTransfer } from "./batch-transfer-record.js";
import { assertAirwallexLivePayoutsEnabled } from "./live-payout-guard.js";
import { discoverAirwallexLivePayoutRoute } from "./beneficiary-schema-live.js";

export async function executeAirwallexLiveGuideBatch(
  Booking,
  bookings,
  guide
) {
  assertAirwallexLivePayoutsEnabled();
  validateAirwallexGuideForPayout(guide, guide?._id);

  if (!guide?._id) {
    throw new Error("AIRWALLEX_GUIDE_REQUIRED");
  }

  const beneficiaryId = guide?.airwallex?.beneficiaryId;

  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_REQUIRED");
  }

  const airwallex = guide?.airwallex;

  if (!airwallex) {
    throw new Error("AIRWALLEX_GUIDE_ROUTING_REQUIRED");
  }

  const discovered = await discoverAirwallexLivePayoutRoute({
    bankCountryCode: airwallex.bankCountryCode,
    accountCurrency: airwallex.accountCurrency,
    transferMethod: airwallex.transferMethod,
    localClearingSystem: airwallex.localClearingSystem || undefined
  });

  const session = await Booking.db.startSession();
  let claimed;

  try {
    await session.withTransaction(async () => {
      claimed = await claimAirwallexGuideBatch(
        Booking,
        bookings,
        String(guide._id),
        beneficiaryId,
        session
      );

      await createAirwallexBatchManifest(
        AirwallexPayoutBatch,
        claimed,
        session
      );
    });
  } finally {
    await session.endSession();
  }

  const payload = buildAirwallexGuideBatchPayloadGlobal(
    claimed,
    beneficiaryId,
    claimed.batchId,
    discovered.route
  );

  let transfer;

  try {
    transfer = await createAirwallexLiveTransfer(
      payload,
      claimed.requestId
    );
  } catch (error) {
    throw new Error(
      "AIRWALLEX_LIVE_BATCH_CREATE_OUTCOME_UNCERTAIN_MANUAL_RECONCILIATION",
      { cause: error }
    );
  }

  try {
    const recordSession = await Booking.db.startSession();

    try {
      let result;

      await recordSession.withTransaction(async () => {
        result = await recordAirwallexBatchTransfer(
          Booking,
          claimed,
          transfer,
          beneficiaryId,
          AirwallexPayoutBatch,
          recordSession
        );
      });

      return result;
    } finally {
      await recordSession.endSession();
    }
  } catch (error) {
    throw new Error(
      "AIRWALLEX_LIVE_BATCH_TRANSFER_RECORD_REQUIRES_RECONCILIATION",
      { cause: error }
    );
  }
}
