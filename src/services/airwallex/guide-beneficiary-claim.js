import { randomUUID } from "node:crypto";

export async function claimGuideBeneficiaryOnboarding(guidesCol, email, schemaInput) {
  if (!email) {
    throw new Error("AIRWALLEX_GUIDE_EMAIL_REQUIRED");
  }

  const fields = ["bankCountryCode", "accountCurrency", "transferMethod"];

  if (
    !schemaInput ||
    fields.some(
      key => typeof schemaInput[key] !== "string" || !schemaInput[key].trim()
    )
  ) {
    throw new Error("AIRWALLEX_ONBOARDING_SCHEMA_REQUIRED");
  }

  const claimId = randomUUID();
  const now = new Date();

  const result = await guidesCol.updateOne(
    {
      email,
      "airwallex.beneficiaryVerified": { $ne: true },
      "airwallex.beneficiaryId": { $in: [null, ""] },
      "airwallex.onboardingClaimId": { $exists: false }
    },
    {
      $set: {
        "airwallex.onboardingClaimId": claimId,
        "airwallex.onboardingClaimedAt": now,
        "airwallex.onboardingBankCountryCode": schemaInput.bankCountryCode,
        "airwallex.onboardingAccountCurrency": schemaInput.accountCurrency,
        "airwallex.onboardingTransferMethod": schemaInput.transferMethod,
        updatedAt: now
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_ONBOARDING_ALREADY_IN_PROGRESS");
  }

  return claimId;
}
