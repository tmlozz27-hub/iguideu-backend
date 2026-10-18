import { claimApprovedOnboardingRecoveryAudit } from "./guide-onboarding-recovery-audit-claim.js";
import { linkRecoveredAirwallexBeneficiary } from "./guide-onboarding-recovery-link.js";

export async function commitReviewedOnboardingRecovery(
  db, session, guide, recovery, beneficiaryId, schemaInput, auditId
) {
  if (!session || typeof session.withTransaction !== "function") {
    throw new Error("AIRWALLEX_RECOVERY_TRANSACTION_REQUIRED");
  }

  let linked;

  await session.withTransaction(async () => {
    await claimApprovedOnboardingRecoveryAudit(
      db, auditId, String(guide._id), beneficiaryId, recovery.claimId, session
    );

    linked = await linkRecoveredAirwallexBeneficiary(
      db, guide, recovery, beneficiaryId, schemaInput, session
    );
  });

  return linked;
}
