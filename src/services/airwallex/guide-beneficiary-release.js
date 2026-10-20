export async function releaseGuideBeneficiaryClaim(
  guidesCol,
  email,
  claimId
) {
  if (!email || !claimId) {
    throw new Error("AIRWALLEX_RELEASE_DATA_REQUIRED");
  }

  const result = await guidesCol.updateOne(
    {
      email,
      "airwallex.onboardingClaimId": claimId,
      "airwallex.onboardingCreatedBeneficiaryId": { $exists: false },
      "airwallex.beneficiaryId": { $in: [null, ""] },
      "airwallex.beneficiaryVerified": { $ne: true }
    },
    {
      $unset: {
        "airwallex.onboardingClaimId": "",
        "airwallex.onboardingClaimedAt": "",
        "airwallex.onboardingBankCountryCode": "",
        "airwallex.onboardingAccountCurrency": "",
        "airwallex.onboardingTransferMethod": ""
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_RELEASE_CONFLICT");
  }

  return { released: true };
}
