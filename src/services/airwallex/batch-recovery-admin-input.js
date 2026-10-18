export function validateAirwallexBatchRecoveryAdminInput(input) {
  const batchId = input?.batchId;
  const transferId = input?.transferId;
  const evidenceReference = input?.evidenceReference;

  if (
    typeof batchId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(batchId) ||
    typeof transferId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(transferId) ||
    typeof evidenceReference !== "string" ||
    evidenceReference.trim().length < 8 ||
    evidenceReference.trim().length > 200 ||
    /[\r\n]/.test(evidenceReference)
  ) {
    throw new Error("AIRWALLEX_BATCH_RECOVERY_ADMIN_INPUT_INVALID");
  }

  return {
    batchId,
    transferId,
    evidenceReference: evidenceReference.trim()
  };
}
