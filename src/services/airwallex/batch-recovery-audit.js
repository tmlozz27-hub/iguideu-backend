export async function recordAirwallexBatchRecoveryAudit(
  db,
  session,
  { batchId, transferId, requestId, evidenceReference, reviewedBy }
) {
  if (
    !db ||
    !session ||
    typeof batchId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(batchId) ||
    typeof transferId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(transferId) ||
    typeof requestId !== "string" ||
    !requestId.trim() ||
    typeof evidenceReference !== "string" ||
    evidenceReference.trim().length < 8 ||
    evidenceReference.trim().length > 200 ||
    /[\r\n]/.test(evidenceReference) ||
    typeof reviewedBy !== "string" ||
    !reviewedBy.trim()
  ) {
    throw new Error("AIRWALLEX_BATCH_RECOVERY_AUDIT_DATA_REQUIRED");
  }

  const result = await db
    .collection("airwallex_batch_recovery_audits")
    .insertOne(
      {
        batchId,
        transferId,
        requestId,
        evidenceReference: evidenceReference.trim(),
        reviewedBy: reviewedBy.trim(),
        action: "TRANSFER_RECOVERY_RECORDED",
        createdAt: new Date()
      },
      { session }
    );

  if (!result.acknowledged) {
    throw new Error("AIRWALLEX_BATCH_RECOVERY_AUDIT_WRITE_FAILED");
  }

  return { auditId: String(result.insertedId) };
}
