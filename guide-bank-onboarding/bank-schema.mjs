import { getAuthenticatedGuideToken } from "./guide-session.mjs";

export async function loadGuideBankSchema({
  bankCountryCode,
  accountCurrency,
  entityType = "PERSONAL",
  transferMethod = "LOCAL"
}) {
  const token = getAuthenticatedGuideToken();

  const response = await fetch("/api/guides/me/airwallex/schema", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    credentials: "omit",
    cache: "no-store",
    body: JSON.stringify({
      bankCountryCode,
      accountCurrency,
      entityType,
      transferMethod
    })
  });

  if (!response.ok) {
    throw new Error("BANK_SCHEMA_REQUEST_FAILED");
  }

  const data = await response.json();

  if (data?.ok !== true || !Array.isArray(data.schema?.fields)) {
    throw new Error("BANK_SCHEMA_INVALID_RESPONSE");
  }

  return data.schema;
}

export async function submitGuideBankOnboarding(schemaInput, beneficiary) {
  const token = getAuthenticatedGuideToken();

  const response = await fetch("/api/guides/me/airwallex/onboarding", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    credentials: "omit",
    cache: "no-store",
    body: JSON.stringify({ schemaInput, beneficiary })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok !== true) {
    const error = new Error("BANK_ONBOARDING_FAILED");
    error.code = result.error || "BANK_ONBOARDING_FAILED";
    error.status = response.status;
    throw error;
  }

  return result;
}
