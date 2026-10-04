export function buildAirwallexBeneficiarySchemaQuery(input = {}) {
  const {
    bankCountryCode,
    accountCurrency,
    entityType,
    transferMethod,
    localClearingSystem,
    countryCode
  } = input;

  const query = {};

  if (bankCountryCode !== undefined) {
    if (!/^[A-Z]{2}$/.test(bankCountryCode)) {
      throw new Error("AIRWALLEX_BANK_COUNTRY_INVALID");
    }
    query.bank_country_code = bankCountryCode;
  }

  if (accountCurrency !== undefined) {
    if (!/^[A-Z]{3}$/.test(accountCurrency)) {
      throw new Error("AIRWALLEX_ACCOUNT_CURRENCY_INVALID");
    }
    query.account_currency = accountCurrency;
  }

  if (entityType !== undefined) {
    if (!["PERSONAL", "COMPANY"].includes(entityType)) {
      throw new Error("AIRWALLEX_ENTITY_TYPE_INVALID");
    }
    query.entity_type = entityType;
  }

  if (transferMethod !== undefined) {
    if (!["LOCAL", "SWIFT"].includes(transferMethod)) {
      throw new Error("AIRWALLEX_TRANSFER_METHOD_INVALID");
    }
    query.transfer_method = transferMethod;
  }

  if (localClearingSystem !== undefined) {
    if (
      typeof localClearingSystem !== "string" ||
      !/^[A-Z0-9_]{2,32}$/.test(localClearingSystem)
    ) {
      throw new Error("AIRWALLEX_LOCAL_CLEARING_SYSTEM_INVALID");
    }
    query.local_clearing_system = localClearingSystem;
  }

  if (countryCode !== undefined) {
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new Error("AIRWALLEX_COUNTRY_CODE_INVALID");
    }
    query.country_code = countryCode;
  }

  return query;
}
export async function getAirwallexLiveBeneficiarySchema(input) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  const query = buildAirwallexBeneficiarySchemaQuery(input);

  const { airwallexLiveLogin } = await import("./client-live.js");
  const token = await airwallexLiveLogin();

  const response = await fetch(
    "https://api.airwallex.com/api/v1/beneficiary_api_schemas/generate",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(query)
    }
  );

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_LIVE_BENEFICIARY_SCHEMA_FAILED_${response.status}`
    );
  }

  const schema = await response.json();

  if (
    !schema ||
    typeof schema !== "object" ||
    !Array.isArray(schema.fields)
  ) {
    throw new Error("AIRWALLEX_LIVE_BENEFICIARY_SCHEMA_INVALID");
  }

  return schema;
}
export async function discoverAirwallexLivePayoutRoute(input = {}) {
  const {
    bankCountryCode,
    accountCurrency,
    transferMethod,
    localClearingSystem
  } = input;

  const schema = await getAirwallexLiveBeneficiarySchema(input);

  const { normalizeAirwallexPayoutRoute } =
    await import("./payout-route.js");

  const route = normalizeAirwallexPayoutRoute({
    bankCountryCode,
    accountCurrency,
    transferMethod,
    localClearingSystem
  });

  const { validateAirwallexRouteAgainstSchema } =
    await import("./payout-route-schema-validation.js");

  validateAirwallexRouteAgainstSchema(schema, route);

  return {
    route,
    schema
  };
}

export async function discoverAirwallexLiveTransferMethods({
  bankCountryCode,
  accountCurrency,
  entityType
}) {
  const schema = await getAirwallexLiveBeneficiarySchema({
    bankCountryCode,
    accountCurrency,
    entityType
  });

  const { getAirwallexTransferMethodsFromSchema } =
    await import("./global-routing-schema.js");

  return {
    bankCountryCode,
    accountCurrency,
    entityType,
    transferMethods: getAirwallexTransferMethodsFromSchema(schema),
    schema
  };
}
