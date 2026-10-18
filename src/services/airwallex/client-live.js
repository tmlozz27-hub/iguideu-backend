const LIVE_URL = "https://api.airwallex.com";

export async function airwallexLiveLogin() {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  const clientId = process.env.AIRWALLEX_LIVE_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_LIVE_API_KEY;

  if (!clientId || !apiKey) {
    throw new Error("AIRWALLEX_LIVE_CREDENTIALS_REQUIRED");
  }

  const response = await fetch(
    `${LIVE_URL}/api/v1/authentication/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-api-key": apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error(`AIRWALLEX_LIVE_AUTH_FAILED_${response.status}`);
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error("AIRWALLEX_LIVE_TOKEN_MISSING");
  }

  return data.token;
}



export async function getAirwallexLiveTransfer(transferId) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (!transferId || !/^[A-Za-z0-9_-]+$/.test(transferId)) {
    throw new Error("INVALID_AIRWALLEX_LIVE_TRANSFER_ID");
  }

  const token = await airwallexLiveLogin();

  const response = await fetch(
    `${LIVE_URL}/api/v1/transfers/${encodeURIComponent(transferId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_LIVE_TRANSFER_QUERY_FAILED_${response.status}`
    );
  }

  return response.json();
}

export async function createAirwallexLiveTransfer(payload, requestId) {
  const { assertAirwallexLivePayoutsEnabled } =
    await import("./live-payout-guard.js");

  assertAirwallexLivePayoutsEnabled();

  if (!requestId || typeof requestId !== "string") {
    throw new Error("AIRWALLEX_LIVE_REQUEST_ID_REQUIRED");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("AIRWALLEX_LIVE_TRANSFER_PAYLOAD_REQUIRED");
  }

  if (payload.request_id && payload.request_id !== requestId) {
    throw new Error("AIRWALLEX_LIVE_REQUEST_ID_MISMATCH");
  }

  const token = await airwallexLiveLogin();

  const response = await fetch(
    `${LIVE_URL}/api/v1/transfers/create`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        request_id: requestId
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_LIVE_TRANSFER_CREATE_FAILED_${response.status}`
    );
  }

  const transfer = await response.json();

  if (!transfer?.id) {
    throw new Error(
      "AIRWALLEX_LIVE_TRANSFER_CREATE_RESPONSE_UNCERTAIN"
    );
  }

  return transfer;
}

export async function findAirwallexLiveTransferByRequestId(requestId) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (
    typeof requestId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)
  ) {
    throw new Error("AIRWALLEX_REQUEST_ID_INVALID");
  }

  const token = await airwallexLiveLogin();

  const url = new URL(`${LIVE_URL}/api/v1/transfers`);
  url.searchParams.set("request_id", requestId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_TRANSFER_LOOKUP_FAILED_${response.status}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data?.items)) {
    throw new Error("AIRWALLEX_TRANSFER_LOOKUP_INVALID_RESPONSE");
  }

  const matches = data.items.filter(
    (item) => item?.request_id === requestId
  );

  if (matches.length !== 1) {
    throw new Error(
      "AIRWALLEX_TRANSFER_LOOKUP_MANUAL_RECONCILIATION_REQUIRED"
    );
  }

  if (
    typeof matches[0].id !== "string" ||
    !matches[0].id.trim()
  ) {
    throw new Error("AIRWALLEX_TRANSFER_LOOKUP_ID_MISSING");
  }

  return matches[0];
}
