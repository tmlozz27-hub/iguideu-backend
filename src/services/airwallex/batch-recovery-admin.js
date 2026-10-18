import { validateAirwallexBatchRecoveryAdminInput } from "./batch-recovery-admin-input.js";
import { getAirwallexLiveTransfer } from "./client-live.js";
import { validateRecoveredAirwallexBatchTransfer } from "./batch-recovery-validation.js";
import { recordRecoveredAirwallexBatchTransfer } from "./batch-recovery-record.js";
import AirwallexPayoutBatch from "../../models/AirwallexPayoutBatch.js";
import Booking from "../../models/Booking.js";
import { recordAirwallexBatchRecoveryAudit } from "./batch-recovery-audit.js";

export async function recoverAirwallexBatchAdmin(input) {
  const { batchId, transferId, evidenceReference } =
    validateAirwallexBatchRecoveryAdminInput(input);

  if (
    typeof input?.reviewedBy !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.reviewedBy.trim()) ||
    input.reviewedBy.length > 254
  ) {
    throw new Error("AIRWALLEX_RECOVERY_ADMIN_IDENTITY_REQUIRED");
  }

  const manifest = await AirwallexPayoutBatch.findOne({ batchId }).lean();

  if (!manifest) {
    throw new Error("AIRWALLEX_RECOVERY_BATCH_NOT_FOUND");
  }

  if (manifest.status !== "PREPARED" || manifest.transferId) {
    throw new Error("AIRWALLEX_RECOVERY_BATCH_ALREADY_LINKED");
  }

  // GET solamente: nunca repetir POST /transfers/create.
  const transfer = await getAirwallexLiveTransfer(transferId);

  if (transfer?.id !== transferId) {
    throw new Error("AIRWALLEX_RECOVERY_REQUESTED_TRANSFER_ID_MISMATCH");
  }

  validateRecoveredAirwallexBatchTransfer(manifest, transfer);

  const session = await Booking.db.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await recordRecoveredAirwallexBatchTransfer(
        Booking,
        manifest,
        transfer,
        AirwallexPayoutBatch,
        session
      );

      const audit = await recordAirwallexBatchRecoveryAudit(
        Booking.db.db,
        session,
        {
          batchId,
          transferId,
          requestId: manifest.requestId,
          evidenceReference,
          reviewedBy: input.reviewedBy
        }
      );

      result = { ...result, auditId: audit.auditId };
    });

    return result;
  } finally {
    await session.endSession();
  }
}



