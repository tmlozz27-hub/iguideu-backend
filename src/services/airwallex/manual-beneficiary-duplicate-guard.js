export async function assertBeneficiaryNotLinkedToAnotherGuide(
  guidesCol,
  guideId,
  beneficiaryId,
  session = undefined
) {
  if (!guidesCol || !guideId || !beneficiaryId) {
    throw new Error("AIRWALLEX_LINK_DATA_REQUIRED");
  }

  const existing = await guidesCol.findOne(
    {
      _id: { $ne: guideId },
      "airwallex.beneficiaryId": beneficiaryId
    },
    {
      projection: { _id: 1 },
      ...(session ? { session } : {})
    }
  );

  if (existing) {
    throw new Error("AIRWALLEX_BENEFICIARY_ALREADY_LINKED");
  }

  return true;
}
