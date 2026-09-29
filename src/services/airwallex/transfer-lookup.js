import { airwallexLogin } from "./client.js";

export async function findAirwallexTransferByRequestId(requestId) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new Error("AIRWALLEX_REQUEST_ID_REQUIRED");
  }

  const token = await airwallexLogin();

  const url = new URL("https://api.sandbox.airwallex.com/api/v1/transfers");
  url.searchParams.set("request_id", requestId.trim());

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`AIRWALLEX_TRANSFER_LOOKUP_FAILED_${response.status}`);
  }

  const result = await response.json();
  if (!result || !Array.isArray(result.items)) {
    throw new Error("AIRWALLEX_TRANSFER_LOOKUP_INVALID_RESPONSE");
  }

  return result.items;
}
