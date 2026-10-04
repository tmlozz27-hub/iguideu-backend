export function validateAirwallexGuideForPayout(guide, expectedGuideId) {
  if (!guide?._id) {
    throw new Error("AIRWALLEX_GUIDE_NOT_FOUND");
  }

  if (String(guide._id) !== String(expectedGuideId)) {
    throw new Error("AIRWALLEX_GUIDE_ID_MISMATCH");
  }

  const airwallex = guide.airwallex;

  if (
    !airwallex ||
    airwallex.beneficiaryVerified !== true ||
    !(airwallex.beneficiaryVerifiedAt instanceof Date) ||
    Number.isNaN(airwallex.beneficiaryVerifiedAt.getTime())
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_NOT_VERIFIED");
  }

  if (
    typeof airwallex.beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(airwallex.beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_REQUIRED");
  }

  if (
    typeof airwallex.bankCountryCode !== "string" ||
    !/^[A-Z]{2}$/.test(airwallex.bankCountryCode)
  ) {
    throw new Error("AIRWALLEX_BANK_COUNTRY_REQUIRED");
  }

  if (
    typeof airwallex.accountCurrency !== "string" ||
    !/^[A-Z]{3}$/.test(airwallex.accountCurrency)
  ) {
    throw new Error("AIRWALLEX_ACCOUNT_CURRENCY_REQUIRED");
  }

  if (
    typeof airwallex.transferMethod !== "string" ||
    !/^[A-Z_]{2,32}$/.test(airwallex.transferMethod)
  ) {
    throw new Error("AIRWALLEX_TRANSFER_METHOD_REQUIRED");
  }

  return guide;
}
