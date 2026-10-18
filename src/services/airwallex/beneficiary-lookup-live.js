import { airwallexLiveLogin } from "./client-live.js";

const LIVE_URL = "https://api.airwallex.com";

export async function getAirwallexLiveBeneficiary(beneficiaryId) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ENV_REQUIRED");
  }

  const id = String(beneficiaryId || "").trim();

  if (!/^[A-Za-z0-9_-]{3,128}$/.test(id)) {
    throw new Error("AIRWALLEX_BENEFICIARY_ID_INVALID");
  }

  const token = await airwallexLiveLogin();

  const response = await fetch(
    `${LIVE_URL}/api/v1/beneficiaries/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_BENEFICIARY_LOOKUP_FAILED_${response.status}`
    );
  }

  const beneficiary = await response.json();

  if (!beneficiary || String(beneficiary.id) !== id) {
    throw new Error("AIRWALLEX_BENEFICIARY_LOOKUP_MISMATCH");
  }

  if (!beneficiary.beneficiary || typeof beneficiary.beneficiary !== "object") {
    throw new Error("AIRWALLEX_BENEFICIARY_DETAILS_MISSING");
  }

  return beneficiary;
}

