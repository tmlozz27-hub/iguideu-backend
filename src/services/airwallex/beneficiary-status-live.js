import { airwallexLiveLogin } from "./client-live.js";

const LIVE_URL = "https://api.airwallex.com";

export async function getAirwallexLiveBeneficiary(beneficiaryId) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (
    typeof beneficiaryId !== "string" ||
    !/^[A-Za-z0-9_-]{3,128}$/.test(beneficiaryId)
  ) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_INVALID");
  }

  const token = await airwallexLiveLogin();

  const response = await fetch(
    `${LIVE_URL}/api/v1/beneficiaries/${encodeURIComponent(beneficiaryId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_BENEFICIARY_QUERY_FAILED_${response.status}`
    );
  }

  const beneficiary = await response.json();

  if (!beneficiary || beneficiary.id !== beneficiaryId) {
    throw new Error("AIRWALLEX_BENEFICIARY_RESPONSE_INVALID");
  }

  return beneficiary;
}