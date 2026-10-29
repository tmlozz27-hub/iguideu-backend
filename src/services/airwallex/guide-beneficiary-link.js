export async function linkAirwallexBeneficiaryToGuide(
  guidesCol,
  email,
  created,
  schemaInput,
  claimId,
  session = undefined
) {
  if (!claimId || typeof claimId !== "string") {
    throw new Error("AIRWALLEX_CLAIM_ID_REQUIRED");
  }

  if (
    !created?.id ||
    typeof created.id !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(created.id) ||
    !email
  ) {
    throw new Error("AIRWALLEX_LINK_DATA_REQUIRED");
  }

  if (
    !schemaInput ||
    !["bankCountryCode", "accountCurrency", "transferMethod"].every(
      (key) =>
        typeof schemaInput[key] === "string" &&
        schemaInput[key].trim()
    )
  ) {
    throw new Error("AIRWALLEX_LINK_SCHEMA_INVALID");
  }

  const now = new Date();

  const result = await guidesCol.updateOne(
    {
      email,
      "airwallex.onboardingClaimId": claimId,
      "airwallex.onboardingCreatedBeneficiaryId": created.id,
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
        "airwallex.beneficiaryVerified": true,
        "airwallex.beneficiaryVerifiedAt": now,
        "airwallex.bankCountryCode": schemaInput.bankCountryCode,
        "airwallex.accountCurrency": schemaInput.accountCurrency,
        "airwallex.transferMethod": schemaInput.transferMethod,
        ...(schemaInput.accountType
          ? { "airwallex.accountType": schemaInput.accountType }
          : {}),
        updatedAt: now
      },
      $unset: {
        "airwallex.onboardingClaimId": "",
        "airwallex.onboardingClaimedAt": "",
        "airwallex.onboardingCreatedBeneficiaryId": "",
        "airwallex.onboardingCreatedAt": "",
        "airwallex.onboardingBankCountryCode": "",
        "airwallex.onboardingAccountCurrency": "",
        "airwallex.onboardingTransferMethod": ""
      }
    },
    session ? { session } : {}
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_GUIDE_LINK_CONFLICT");
  }

  return {
    beneficiaryId: created.id,
    beneficiaryVerified: true,
    beneficiaryVerifiedAt: now
  };
}
