export function normalizeAirwallexPayoutRoute(input = {}) {
  const {
    bankCountryCode,
    accountCurrency,
    transferMethod,
    localClearingSystem = ""
  } = input;

  if (!/^[A-Z]{2}$/.test(bankCountryCode || "")) {
    throw new Error("AIRWALLEX_BANK_COUNTRY_INVALID");
  }

  if (!/^[A-Z]{3}$/.test(accountCurrency || "")) {
    throw new Error("AIRWALLEX_ACCOUNT_CURRENCY_INVALID");
  }

  if (!["LOCAL", "SWIFT"].includes(transferMethod)) {
    throw new Error("AIRWALLEX_TRANSFER_METHOD_INVALID");
  }

  if (
    localClearingSystem &&
    !/^[A-Z0-9_]{2,32}$/.test(localClearingSystem)
  ) {
    throw new Error("AIRWALLEX_LOCAL_CLEARING_SYSTEM_INVALID");
  }

  return {
    bankCountryCode,
    accountCurrency,
    transferMethod,
    localClearingSystem
  };
}

export function buildAirwallexPayoutRouteKey(input) {
  const route = normalizeAirwallexPayoutRoute(input);

  return [
    route.bankCountryCode,
    route.accountCurrency,
    route.transferMethod,
    route.localClearingSystem || "DEFAULT"
  ].join("_");
}
