import { airwallexLiveLogin } from "./client-live.js";
import { validateAirwallexBeneficiaryDataAgainstSchema } from "./beneficiary-schema-validation.js";
import { getAirwallexLiveBeneficiarySchema } from "./beneficiary-schema-live.js";
import { buildAirwallexLiveBeneficiaryPayload } from "./beneficiary-payload-live.js";

const LIVE_URL = "https://api.airwallex.com";

export async function validateAirwallexLiveBeneficiary({
  schemaInput,
  beneficiary
}) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ENV_REQUIRED");
  }

  if (!beneficiary || typeof beneficiary !== "object") {
    throw new Error("AIRWALLEX_BENEFICIARY_DATA_REQUIRED");
  }

  const schema = await getAirwallexLiveBeneficiarySchema(schemaInput);

  validateAirwallexBeneficiaryDataAgainstSchema(schema, beneficiary);

  const apiPayload = buildAirwallexLiveBeneficiaryPayload(beneficiary);

  const token = await airwallexLiveLogin();

  const response = await fetch(
    `${LIVE_URL}/api/v1/beneficiaries/validate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(apiPayload)
    }
  );

  if (!response.ok) {
    const error = new Error(
      `AIRWALLEX_LIVE_BENEFICIARY_VALIDATION_FAILED_${response.status}`
    );

    error.httpStatus = response.status;
    error.operation = "BENEFICIARY_VALIDATE";
    error.safeToRetryCreation = false;

    throw error;
  }

  return response.json();
}

export async function createAirwallexLiveBeneficiary({
  schemaInput,
  beneficiary,
  externalIdentifier
}) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ENV_REQUIRED");
  }

  if (process.env.AIRWALLEX_LIVE_BENEFICIARIES_ENABLED !== "true") {
    throw new Error("AIRWALLEX_LIVE_BENEFICIARIES_DISABLED");
  }

  if (!beneficiary || typeof beneficiary !== "object") {
    throw new Error("AIRWALLEX_BENEFICIARY_DATA_REQUIRED");
  }

  const schema = await getAirwallexLiveBeneficiarySchema(schemaInput);

  validateAirwallexBeneficiaryDataAgainstSchema(schema, beneficiary);

  const apiPayload = buildAirwallexLiveBeneficiaryPayload(beneficiary);

  if (
    typeof externalIdentifier !== "string" ||
    !/^IGUIDEU-GUIDE-[a-fA-F0-9]{24}$/.test(externalIdentifier)
  ) {
    throw new Error("AIRWALLEX_EXTERNAL_IDENTIFIER_INVALID");
  }

  apiPayload.beneficiary.additional_info.external_identifier = externalIdentifier;

  const token = await airwallexLiveLogin();

  const response = await fetch(
    `${LIVE_URL}/api/v1/beneficiaries/create`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(apiPayload)
    }
  );

  if (!response.ok) {
    throw new Error(
      `AIRWALLEX_LIVE_BENEFICIARY_CREATE_FAILED_${response.status}`
    );
  }

  const created = await response.json();

  if (
    !created ||
    typeof created.id !== "string" ||
    created.id.length < 3
  ) {
    throw new Error("AIRWALLEX_LIVE_BENEFICIARY_CREATE_INVALID_RESPONSE");
  }

  return created;
}
