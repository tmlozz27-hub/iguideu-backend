const BANK_FIELDS = new Set([
  "bank_country_code", "account_currency", "local_clearing_system",
  "account_number", "account_name", "iban", "swift_code",
  "bank_name", "bank_code", "branch_code", "routing_number",
  "sort_code", "bsb_number", "clabe", "cbu"
]);

const ADDRESS_FIELDS = new Set([
  "country_code", "street_address", "city", "postcode",
  "state", "province"
]);

const ADDITIONAL_FIELDS = new Set([
  "personal_id_type", "personal_id_number"
]);

const RESERVED_FIELDS = new Set([
  "type", "entity_type", "transfer_method", "transfer_methods"
]);

export function buildAirwallexLiveBeneficiaryPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("AIRWALLEX_BENEFICIARY_DATA_REQUIRED");
  }

  if (data.type !== "BANK_ACCOUNT" ||
      !["PERSONAL", "COMPANY"].includes(data.entity_type)) {
    throw new Error("AIRWALLEX_BENEFICIARY_TYPE_INVALID");
  }

  const beneficiary = {
    type: data.type,
    entity_type: data.entity_type,
    bank_details: {},
    address: {},
    additional_info: {}
  };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;

    if (RESERVED_FIELDS.has(key)) continue;

    if (BANK_FIELDS.has(key)) {
      beneficiary.bank_details[key] = value;
    } else if (ADDRESS_FIELDS.has(key)) {
      beneficiary.address[key] = value;
    } else if (ADDITIONAL_FIELDS.has(key)) {
      beneficiary.additional_info[key] = value;
    } else {
      throw new Error("AIRWALLEX_UNMAPPED_FIELD_" + key);
    }
  }

  const methods = Array.isArray(data.transfer_methods)
    ? data.transfer_methods
    : [data.transfer_method];

  if (methods.length !== 1 ||
      !["LOCAL", "SWIFT"].includes(methods[0])) {
    throw new Error("AIRWALLEX_TRANSFER_METHOD_INVALID");
  }

  return { beneficiary, transfer_methods: methods };
}
