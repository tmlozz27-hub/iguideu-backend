export function verifyAirwallexBeneficiaryMatch(guide, remote) {
  const local = guide?.airwallex;
  const beneficiary = remote?.beneficiary;

  if (!local?.beneficiaryId || !beneficiary) {
    throw new Error("AIRWALLEX_BENEFICIARY_MATCH_DATA_MISSING");
  }

  if (String(remote.id) !== String(local.beneficiaryId)) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_MISMATCH");
  }

  const expectedIdentifier = `IGUIDEU-GUIDE-${guide._id}`;
  const remoteIdentifier =
    beneficiary.additional_info?.external_identifier ??
    remote.additional_info?.external_identifier;

  if (
    !guide._id ||
    typeof remoteIdentifier !== "string" ||
    remoteIdentifier !== expectedIdentifier
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_OWNER_MISMATCH");
  }
  const bank = beneficiary.bank_details || {};

  if (
    bank.bank_country_code !== local.bankCountryCode ||
    bank.account_currency !== local.accountCurrency
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_BANK_MISMATCH");
  }

  return true;
}
