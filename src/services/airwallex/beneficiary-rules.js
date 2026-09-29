export function validateAirwallexBeneficiaryId(beneficiaryId) {
  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_INVALID_BENEFICIARY_ID");
  }

  return beneficiaryId;
}
