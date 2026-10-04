import { getAirwallexSchemaAllowedValues } from "./global-routing-schema.js";

export function assertAirwallexSchemaSupportsValue(schema, key, value) {
  const allowed = getAirwallexSchemaAllowedValues(schema, key);

  if (allowed.length > 0 && !allowed.includes(value)) {
    throw new Error(`AIRWALLEX_SCHEMA_VALUE_UNSUPPORTED_${key}_${value}`);
  }

  return value;
}

export function validateAirwallexRouteAgainstSchema(schema, route) {
  if (!route || typeof route !== "object") {
    throw new Error("AIRWALLEX_ROUTE_REQUIRED");
  }

  assertAirwallexSchemaSupportsValue(
    schema,
    "bank_country_code",
    route.bankCountryCode
  );

  assertAirwallexSchemaSupportsValue(
    schema,
    "account_currency",
    route.accountCurrency
  );

  assertAirwallexSchemaSupportsValue(
    schema,
    "transfer_method",
    route.transferMethod
  );

  return route;
}
