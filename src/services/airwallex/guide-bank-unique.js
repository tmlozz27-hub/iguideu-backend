import { bankAccountFingerprint } from "./bank-account-fingerprint.js";

export async function reserveUniqueGuideBankAccount(
  guidesCol,
  guideId,
  beneficiary
) {
  if (!guideId) {
    throw new Error("BANK_GUIDE_ID_REQUIRED");
  }

  const fingerprint = bankAccountFingerprint(beneficiary);

  const collection = guidesCol.db.collection("guide_bank_accounts");

  try {
    await collection.insertOne({
      fingerprint,
      guideId: String(guideId),
      status: "RESERVED",
      createdAt: new Date()
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = new Error("BANK_ACCOUNT_ALREADY_REGISTERED");
      duplicate.status = 409;
      throw duplicate;
    }

    throw error;
  }

  return fingerprint;
}

export async function releaseUniqueGuideBankAccount(
  guidesCol,
  guideId,
  fingerprint
) {
  if (!guideId || !fingerprint) {
    throw new Error("BANK_RESERVATION_RELEASE_DATA_REQUIRED");
  }

  const collection = guidesCol.db.collection("guide_bank_accounts");

  const result = await collection.deleteOne({
    guideId: String(guideId),
    fingerprint,
    status: "RESERVED"
  });

  return result.deletedCount === 1;
}

export async function confirmUniqueGuideBankAccount(
  guidesCol,
  guideId,
  fingerprint,
  beneficiaryId
) {
  if (!guideId || !fingerprint || !beneficiaryId) {
    throw new Error("BANK_CONFIRMATION_DATA_REQUIRED");
  }

  const collection = guidesCol.db.collection("guide_bank_accounts");

  const result = await collection.updateOne(
    {
      guideId: String(guideId),
      fingerprint,
      status: "RESERVED"
    },
    {
      $set: {
        status: "LINKED",
        beneficiaryId: String(beneficiaryId),
        linkedAt: new Date()
      }
    }
  );

  if (result.modifiedCount !== 1) {
    throw new Error("BANK_CONFIRMATION_CONFLICT");
  }

  return true;
}
