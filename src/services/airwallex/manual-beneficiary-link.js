export async function linkExistingManualBeneficiary(
  db,
  session,
  { guideId, beneficiaryId, schemaInput }
) {
  if (
    !db ||
    !session ||
    !guideId ||
    typeof beneficiaryId !== "string" ||
    !beneficiaryId.trim() ||
    !schemaInput ||
    !["bankCountryCode", "accountCurrency", "transferMethod"].every(
      key => typeof schemaInput[key] === "string" && schemaInput[key].trim()
    )
  ) {
    throw new Error("AIRWALLEX_MANUAL_LINK_DATA_INVALID");
  }

  const result = await db.collection("guides").updateOne(
    {
      _id: guideId,
      "airwallex.beneficiaryVerified": { $ne: true },
      $or: [
        { "airwallex.beneficiaryId": { $exists: false } },
        { "airwallex.beneficiaryId": null },
        { "airwallex.beneficiaryId": "" }
      ]
    },
    {
      $set: {
        "airwallex.beneficiaryId": beneficiaryId.trim(),
        "airwallex.beneficiaryVerified": false,
        "airwallex.beneficiaryVerifiedAt": null,
        "airwallex.bankCountryCode": schemaInput.bankCountryCode,
        "airwallex.accountCurrency": schemaInput.accountCurrency,
        "airwallex.transferMethod": schemaInput.transferMethod,
        updatedAt: new Date()
      }
    },
    { session }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("AIRWALLEX_MANUAL_LINK_CONFLICT");
  }

  return {
    beneficiaryId: beneficiaryId.trim(),
    beneficiaryVerified: false
  };
}
