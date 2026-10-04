export function getAirwallexSchemaAllowedValues(schema, key) {
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error("AIRWALLEX_SCHEMA_INVALID");
  }

  const field = schema.fields.find((item) => item?.key === key);

  if (!field) {
    throw new Error(`AIRWALLEX_SCHEMA_FIELD_NOT_FOUND_${key}`);
  }

  const pattern = field?.rule?.pattern;

  if (typeof pattern !== "string") {
    throw new Error(`AIRWALLEX_SCHEMA_PATTERN_INVALID_${key}`);
  }

  if (pattern === "") {
    return [];
  }

  return pattern
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseAirwallexGlobalRoutingSchema(schema) {
  return {
    entityTypes: getAirwallexSchemaAllowedValues(schema, "entity_type"),
    bankCountryCodes: getAirwallexSchemaAllowedValues(
      schema,
      "bank_country_code"
    ),
    accountCurrencies: getAirwallexSchemaAllowedValues(
      schema,
      "account_currency"
    ),
    transferMethods: getAirwallexSchemaAllowedValues(
      schema,
      "transfer_method"
    )
  };
}

export function getAirwallexTransferMethodsFromSchema(schema) {
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error("AIRWALLEX_SCHEMA_INVALID");
  }

  const field = schema.fields.find(
    (item) => item?.key === "transfer_method"
  );

  if (!field || typeof field?.rule?.pattern !== "string") {
    throw new Error("AIRWALLEX_TRANSFER_METHOD_SCHEMA_INVALID");
  }

  const methods = field.rule.pattern
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(methods)];
}
