export function buildAirwallexLiveBeneficiaryPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("AIRWALLEX_BENEFICIARY_DATA_REQUIRED");
  }

  const beneficiary = {
    type: data.type,
    entity_type: data.entity_type,
    bank_details: {
      bank_country_code: data.bank_country_code,
      account_currency: data.account_currency,
      account_number: data.account_number,
      account_name: data.account_name
    },
    address: {
      country_code: data.country_code,
      street_address: data.street_address,
      city: data.city,
      postcode: data.postcode
    },
    additional_info: {
      personal_id_type: data.personal_id_type,
      personal_id_number: data.personal_id_number
    }
  };

  return {
    beneficiary,
    transfer_methods: [data.transfer_method]
  };
}
