export async function linkAirwallexBeneficiaryToGuide(
  guidesCol,
  email,
  created,
  schemaInput,
  claimId
) {
  if (!claimId || typeof claimId !== "string") {
    throw new Error("AIRWALLEX_CLAIM_ID_REQUIRED");
  }
  if (!created?.id || !email) {
    throw new Error("AIRWALLEX_LINK_DATA_REQUIRED");
  }

  if (
    !schemaInput ||
    !["bankCountryCode", "accountCurrency", "transferMethod"].every(
      (key) => typeof schemaInput[key] === "string" && schemaInput[key].trim()
    )
  ) {
    throw new Error("AIRWALLEX_LINK_SCHEMA_INVALID");
  }

  const now = new Date();

  const result = await guidesCol.updateOne(
    {
      email,
      "airwallex.onboardingClaimId": claimId,
      "airwallex.beneficiaryVerified": { $ne: true },
      $or: [
        { "airwallex.beneficiaryId": { $exists: false } },
        { "airwallex.beneficiaryId": null },
        { "airwallex.beneficiaryId": "" }
      ]
    },
    {
      $set: {
        "airwallex.beneficiaryId": created.id,
        "airwallex.beneficiaryVerified": false,
        "airwallex.beneficiaryVerifiedAt": null,
        "airwallex.bankCountryCode": schemaInput.bankCountryCode,
        "airwallex.accountCurrency": schemaInput.accountCurrency,
        "airwallex.transferMethod": schemaInput.transferMethod,
        updatedAt: now
      },
      $unset: {
        "airwallex.onboardingClaimId": "",
        "airwallex.onboardingClaimedAt": ""
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_GUIDE_LINK_CONFLICT");
  }

  return {
    beneficiaryId: created.id,
    beneficiaryVerified: false,
    beneficiaryVerifiedAt: null
  };
}
