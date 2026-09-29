const SANDBOX_URL = "https://api.sandbox.airwallex.com";

export async function airwallexLogin() {
  if (process.env.AIRWALLEX_ENV !== "sandbox") { throw new Error("AIRWALLEX_SANDBOX_ONLY"); }
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_API_KEY;

  if (!clientId || !apiKey) {
    throw new Error("AIRWALLEX_SANDBOX_CREDENTIALS_REQUIRED");
  }

  const response = await fetch(
    `${SANDBOX_URL}/api/v1/authentication/login`,
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
    throw new Error(`AIRWALLEX_AUTH_FAILED_${response.status}`);
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error("AIRWALLEX_TOKEN_MISSING");
  }

  return data.token;
}

export async function getAirwallexTransfer(transferId) {
  if (!transferId || !/^[A-Za-z0-9_-]+$/.test(transferId)) {
    throw new Error("INVALID_AIRWALLEX_TRANSFER_ID");
  }

  const token = await airwallexLogin();

  const response = await fetch(
    `${SANDBOX_URL}/api/v1/transfers/${encodeURIComponent(transferId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`AIRWALLEX_TRANSFER_QUERY_FAILED_${response.status}`);
  }

  return response.json();
}


export async function createAirwallexTransfer(payload, requestId) {
  if (process.env.AIRWALLEX_ENV !== "sandbox") {
    throw new Error("AIRWALLEX_SANDBOX_ONLY");
  }

  if (!requestId || typeof requestId !== "string") {
    throw new Error("AIRWALLEX_REQUEST_ID_REQUIRED");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("AIRWALLEX_TRANSFER_PAYLOAD_REQUIRED");
  }

  if (payload.request_id && payload.request_id !== requestId) {
    throw new Error("AIRWALLEX_REQUEST_ID_MISMATCH");
  }

  const token = await airwallexLogin();

  const response = await fetch(
    `${SANDBOX_URL}/api/v1/transfers/create`,
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
    throw new Error(`AIRWALLEX_TRANSFER_CREATE_FAILED_${response.status}`);
  }

  const transfer = await response.json();

  if (!transfer?.id) {
    throw new Error("AIRWALLEX_TRANSFER_CREATE_RESPONSE_UNCERTAIN");
  }

  return transfer;
}
